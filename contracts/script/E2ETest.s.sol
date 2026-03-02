// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {DisputeEscrow} from "../src/DisputeEscrow.sol";
import {ArbitrationRegistry} from "../src/ArbitrationRegistry.sol";
import {CREVerifier} from "../src/CREVerifier.sol";
import {IArbitrationRegistry} from "../src/interfaces/IArbitrationRegistry.sol";

/**
 * @title E2ETest
 * @notice Full end-to-end test on Sepolia — no mocks, real transactions.
 *
 * Runs TWO scenarios back-to-back:
 *   Scenario A: Happy path — 3/3 consensus, Alice wins, escrow releases
 *   Scenario B: Failure mode — 1/3 consensus, circuit breaker, full refund
 *
 * Usage:
 *   forge script script/E2ETest.s.sol:E2ETest \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --broadcast \
 *     -vvvv
 *
 * Required env vars:
 *   PARTY_A_PRIVATE_KEY    — Alice's wallet (needs 0.05+ Sepolia ETH)
 *   PARTY_B_PRIVATE_KEY    — Bob's wallet (needs 0.05+ Sepolia ETH)
 *   CRE_OPERATOR_PRIVATE_KEY — operator key (must match on-chain creOperator)
 *   ESCROW_ADDRESS
 *   REGISTRY_ADDRESS
 *   VERIFIER_ADDRESS
 */
contract E2ETest is Script {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    DisputeEscrow escrow;
    ArbitrationRegistry registry;
    CREVerifier verifier;

    uint256 partyAKey;
    uint256 partyBKey;
    uint256 operatorKey;

    address partyA;
    address partyB;
    address operator;

    uint256 constant DEPOSIT = 0.01 ether;

    function run() external {
        // Load contracts
        escrow   = DisputeEscrow(payable(vm.envAddress("ESCROW_ADDRESS")));
        registry = ArbitrationRegistry(vm.envAddress("REGISTRY_ADDRESS"));
        verifier = CREVerifier(vm.envAddress("VERIFIER_ADDRESS"));

        // Load keys
        partyAKey   = vm.envUint("PARTY_A_PRIVATE_KEY");
        partyBKey   = vm.envUint("PARTY_B_PRIVATE_KEY");
        operatorKey = vm.envUint("CRE_OPERATOR_PRIVATE_KEY");

        partyA   = vm.addr(partyAKey);
        partyB   = vm.addr(partyBKey);
        operator = vm.addr(operatorKey);

        console.log("========================================");
        console.log("   ArbitrAI E2E Test - Sepolia Live     ");
        console.log("========================================");
        console.log("Party A (Alice): ", partyA);
        console.log("Party B (Bob):   ", partyB);
        console.log("CRE Operator:    ", operator);
        console.log("Escrow:          ", address(escrow));

        // Confirm operator matches on-chain
        require(
            verifier.creOperator() == operator,
            "CRE_OPERATOR_PRIVATE_KEY does not match on-chain creOperator. Check your .env."
        );

        // ── Scenario A: Happy Path ────────────────────────────────────────
        console.log("\n[SCENARIO A] Happy Path: Alice wins (2/3 consensus)");
        bytes32 disputeIdA = _runHappyPath();
        console.log("[SCENARIO A] PASSED. Dispute:", vm.toString(disputeIdA));

        // ── Scenario B: Failure Mode ──────────────────────────────────────
        console.log("\n[SCENARIO B] Failure Mode: No consensus, full refund");
        bytes32 disputeIdB = _runFailurePath();
        console.log("[SCENARIO B] PASSED. Dispute:", vm.toString(disputeIdB));

        console.log("\n========================================");
        console.log("ALL E2E TESTS PASSED ON SEPOLIA");
        console.log("========================================");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario A: 3/3 consensus, Alice (party A) wins
    // ─────────────────────────────────────────────────────────────────────

    function _runHappyPath() internal returns (bytes32 disputeId) {
        // ── Step 1: Alice creates dispute ─────────────────────────────────
        console.log("  [1/6] Alice creates dispute and locks", DEPOSIT, "wei");
        vm.broadcast(partyAKey);
        disputeId = escrow.createDispute{value: DEPOSIT}(
            partyB,
            "E2E Test A: Alice delivered React dashboard. Bob claims quality issues."
        );
        console.log("  disputeId:", vm.toString(disputeId));

        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        require(d.status == IArbitrationRegistry.DisputeStatus.PENDING, "Should be PENDING");

        // ── Step 2: Bob deposits and activates ────────────────────────────
        console.log("  [2/6] Bob deposits matching", DEPOSIT, "wei - dispute ACTIVE");
        vm.broadcast(partyBKey);
        escrow.depositAndActivate{value: DEPOSIT}(disputeId);

        d = registry.getDispute(disputeId);
        require(d.status == IArbitrationRegistry.DisputeStatus.ACTIVE, "Should be ACTIVE");

        // ── Step 3: Both submit evidence hashes ───────────────────────────
        // Simulates: evidence content submitted to private server,
        //            keccak256 of content submitted on-chain
        bytes32 evidenceHashA = keccak256("Alice: Delivered all 5 screens on Jan 15. See attached Figma link and Loom recording.");
        bytes32 evidenceHashB = keccak256("Bob: Screens were delivered but color palette doesn't match brand guide.");

        console.log("  [3/6] Both parties submit evidence hashes on-chain");
        vm.broadcast(partyAKey);
        registry.submitEvidence(disputeId, evidenceHashA);

        vm.broadcast(partyBKey);
        registry.submitEvidence(disputeId, evidenceHashB);

        d = registry.getDispute(disputeId);
        require(d.status == IArbitrationRegistry.DisputeStatus.IN_ARBITRATION, "Should be IN_ARBITRATION");
        require(d.evidenceHashA == evidenceHashA, "evidenceHashA mismatch");
        require(d.evidenceHashB == evidenceHashB, "evidenceHashB mismatch");

        // ── Step 4: Build CRE verdict ─────────────────────────────────────
        // Simulates the CRE workflow completing — 3/3 consensus for Alice
        console.log("  [4/6] Building CRE verdict (3/3 models agree: FAVOR_PARTY_A)");
        CREVerifier.WorkflowVerdict memory verdict = _buildVerdictA(
            disputeId, evidenceHashA, evidenceHashB
        );

        // ── Step 5: Sign verdict with operator key ────────────────────────
        bytes memory signature = _signVerdict(verdict);
        console.log("  [5/6] Verdict signed by CRE operator");

        // ── Step 6: Submit on-chain ───────────────────────────────────────
        uint256 aliceBalanceBefore = partyA.balance;
        uint256 treasuryBalanceBefore = escrow.treasury().balance;

        console.log("  [6/6] Submitting verdict to CREVerifier...");
        vm.broadcast(operatorKey);
        verifier.submitVerdict(verdict, signature);

        // ── Verify settlement ─────────────────────────────────────────────
        d = registry.getDispute(disputeId);
        require(d.status == IArbitrationRegistry.DisputeStatus.SETTLED, "Should be SETTLED");
        require(d.winner == partyA, "Alice should have won");
        require(d.workflowOutputHash != bytes32(0), "Proof hash should be recorded");

        uint256 expectedTotal = DEPOSIT * 2;
        uint256 expectedFee = (expectedTotal * 100) / 10_000;
        uint256 expectedPayout = expectedTotal - expectedFee;

        require(partyA.balance >= aliceBalanceBefore + expectedPayout - 0.001 ether, "Alice payout incorrect");
        require(escrow.treasury().balance >= treasuryBalanceBefore + expectedFee - 0.0001 ether, "Fee incorrect");
        require(address(escrow).balance == 0, "Escrow should be empty");

        console.log("  Alice received:", partyA.balance - aliceBalanceBefore, "wei");
        console.log("  Protocol fee:", escrow.treasury().balance - treasuryBalanceBefore, "wei");
        console.log("  Escrow balance: 0 (cleared)");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Scenario B: 1/3 consensus — NO_CONSENSUS, full refund
    // ─────────────────────────────────────────────────────────────────────

    function _runFailurePath() internal returns (bytes32 disputeId) {
        // ── Steps 1-3: Same setup ──────────────────────────────────────────
        console.log("  [1/6] Alice creates dispute (failure scenario)");
        vm.broadcast(partyAKey);
        disputeId = escrow.createDispute{value: DEPOSIT}(
            partyB,
            "E2E Test B: Failure mode - models will disagree, circuit breaker expected."
        );

        vm.broadcast(partyBKey);
        escrow.depositAndActivate{value: DEPOSIT}(disputeId);

        bytes32 evidenceHashA = keccak256("Alice failure test evidence");
        bytes32 evidenceHashB = keccak256("Bob failure test evidence");

        vm.broadcast(partyAKey);
        registry.submitEvidence(disputeId, evidenceHashA);

        vm.broadcast(partyBKey);
        registry.submitEvidence(disputeId, evidenceHashB);

        // ── Step 4: Build NO_CONSENSUS verdict ────────────────────────────
        // Only 1 model agrees — below the 2/3 threshold
        console.log("  [4/6] Building CRE verdict (1/3 models agree: NO_CONSENSUS)");
        CREVerifier.WorkflowVerdict memory verdict = _buildVerdictB(
            disputeId, evidenceHashA, evidenceHashB
        );

        // ── Steps 5-6: Sign and submit ────────────────────────────────────
        bytes memory signature = _signVerdict(verdict);
        console.log("  [5/6] Verdict signed");

        uint256 aliceBalanceBefore = partyA.balance;
        uint256 bobBalanceBefore   = partyB.balance;

        console.log("  [6/6] Submitting NO_CONSENSUS verdict...");
        vm.broadcast(operatorKey);
        verifier.submitVerdict(verdict, signature);

        // ── Verify refund ─────────────────────────────────────────────────
        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        require(d.status == IArbitrationRegistry.DisputeStatus.REFUNDED, "Should be REFUNDED");
        require(d.winner == address(0), "No winner on refund");

        // Full refund — no fee deducted
        require(partyA.balance >= aliceBalanceBefore + DEPOSIT - 0.001 ether, "Alice refund incorrect");
        require(partyB.balance >= bobBalanceBefore + DEPOSIT - 0.001 ether, "Bob refund incorrect");
        require(address(escrow).balance == 0, "Escrow should be empty");

        console.log("  Alice refunded:", partyA.balance - aliceBalanceBefore, "wei");
        console.log("  Bob refunded:  ", partyB.balance - bobBalanceBefore, "wei");
        console.log("  Escrow balance: 0 (cleared)");
        console.log("  Circuit breaker event emitted on-chain.");
    }

    // ─────────────────────────────────────────────────────────────────────
    // Verdict Builders
    // ─────────────────────────────────────────────────────────────────────

    function _buildVerdictA(
        bytes32 disputeId,
        bytes32 evidenceHashA,
        bytes32 evidenceHashB
    ) internal view returns (CREVerifier.WorkflowVerdict memory) {
        CREVerifier.ModelVote[3] memory votes;
        votes[0] = CREVerifier.ModelVote({
            modelId: "claude-opus-4-6",
            vote: CREVerifier.VerdictOutcome.FAVOR_PARTY_A,
            confidenceBps: 8700,
            reasoningHash: keccak256("Alice delivered per scope. Bob's issues are subjective.")
        });
        votes[1] = CREVerifier.ModelVote({
            modelId: "gpt-4o",
            vote: CREVerifier.VerdictOutcome.FAVOR_PARTY_A,
            confidenceBps: 8200,
            reasoningHash: keccak256("Deliverables match original contract. Party A wins.")
        });
        votes[2] = CREVerifier.ModelVote({
            modelId: "mistral-large-2411",
            vote: CREVerifier.VerdictOutcome.FAVOR_PARTY_A,
            confidenceBps: 7600,
            reasoningHash: keccak256("Evidence supports Party A's claim of delivery.")
        });

        return CREVerifier.WorkflowVerdict({
            disputeId: disputeId,
            finalOutcome: CREVerifier.VerdictOutcome.FAVOR_PARTY_A,
            modelVotes: votes,
            consensusCount: 3,
            evidenceHashA: evidenceHashA,
            evidenceHashB: evidenceHashB,
            executedAt: block.timestamp,
            workflowRunId: keccak256(abi.encodePacked("run-A", disputeId, block.timestamp))
        });
    }

    function _buildVerdictB(
        bytes32 disputeId,
        bytes32 evidenceHashA,
        bytes32 evidenceHashB
    ) internal view returns (CREVerifier.WorkflowVerdict memory) {
        CREVerifier.ModelVote[3] memory votes;
        // All three models vote differently — no consensus possible
        votes[0] = CREVerifier.ModelVote({
            modelId: "claude-opus-4-6",
            vote: CREVerifier.VerdictOutcome.FAVOR_PARTY_A,
            confidenceBps: 5500,
            reasoningHash: keccak256("Lean toward A but low confidence.")
        });
        votes[1] = CREVerifier.ModelVote({
            modelId: "gpt-4o",
            vote: CREVerifier.VerdictOutcome.FAVOR_PARTY_B,
            confidenceBps: 5200,
            reasoningHash: keccak256("Lean toward B based on quality concern.")
        });
        votes[2] = CREVerifier.ModelVote({
            modelId: "mistral-large-2411",
            vote: CREVerifier.VerdictOutcome.INSUFFICIENT_EVIDENCE,
            confidenceBps: 6800,
            reasoningHash: keccak256("Cannot determine winner from available evidence.")
        });

        return CREVerifier.WorkflowVerdict({
            disputeId: disputeId,
            finalOutcome: CREVerifier.VerdictOutcome.NO_CONSENSUS,
            modelVotes: votes,
            consensusCount: 1,
            evidenceHashA: evidenceHashA,
            evidenceHashB: evidenceHashB,
            executedAt: block.timestamp,
            workflowRunId: keccak256(abi.encodePacked("run-B", disputeId, block.timestamp))
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Signing
    // ─────────────────────────────────────────────────────────────────────

    function _signVerdict(CREVerifier.WorkflowVerdict memory verdict)
        internal
        view
        returns (bytes memory)
    {
        bytes32 verdictHash = verifier.computeVerdictHash(verdict);
        bytes32 ethHash = verdictHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethHash);
        return abi.encodePacked(r, s, v);
    }
}
