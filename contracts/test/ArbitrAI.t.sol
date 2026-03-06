// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ArbitrationRegistry} from "../src/ArbitrationRegistry.sol";
import {DisputeEscrow} from "../src/DisputeEscrow.sol";
import {CREVerifier} from "../src/CREVerifier.sol";
import {IArbitrationRegistry} from "../src/interfaces/IArbitrationRegistry.sol";

/**
 * @title ArbitrAI Test Suite
 * @notice Full lifecycle tests covering happy paths, failure modes, and edge cases
 */
contract ArbitrAITest is Test {
    // ─────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────

    ArbitrationRegistry registry;
    DisputeEscrow escrow;
    CREVerifier verifier;

    // Test accounts
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");
    address owner = makeAddr("owner");

    // CRE operator keypair (generated deterministically for tests)
    uint256 operatorPrivKey = 0xA11CE; // test key only
    address operatorAddr;

    uint256 constant DEPOSIT = 0.1 ether;

    // ─────────────────────────────────────────────────────────
    // Setup
    // ─────────────────────────────────────────────────────────

    function setUp() public {
        operatorAddr = vm.addr(operatorPrivKey);

        vm.startPrank(owner);

        // Deploy
        registry = new ArbitrationRegistry();
        escrow = new DisputeEscrow(treasury);
        verifier = new CREVerifier(operatorAddr);

        // Wire
        registry.setAuthorized(address(escrow), true);
        registry.setAuthorized(address(verifier), true);
        escrow.setContracts(address(registry), address(verifier));
        verifier.setContracts(address(escrow), address(registry));

        vm.stopPrank();

        // Fund test accounts
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // ─────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────

    function _createAndActivateDispute() internal returns (bytes32 disputeId) {
        vm.prank(alice);
        disputeId = escrow.createDispute{value: DEPOSIT}(bob, "Alice vs Bob: freelance dispute");

        vm.prank(bob);
        escrow.depositAndActivate{value: DEPOSIT}(disputeId);
    }

    function _submitEvidence(bytes32 disputeId) internal {
        bytes32 evidenceA = keccak256("alice-evidence-confidential-url");
        bytes32 evidenceB = keccak256("bob-evidence-confidential-url");

        vm.prank(alice);
        registry.submitEvidence(disputeId, evidenceA);

        vm.prank(bob);
        registry.submitEvidence(disputeId, evidenceB);
    }

    function _buildVerdict(bytes32 disputeId, CREVerifier.VerdictOutcome outcome, uint8 consensusCount)
        internal
        view
        returns (CREVerifier.WorkflowVerdict memory)
    {
        IArbitrationRegistry.DisputeRecord memory dispute = registry.getDispute(disputeId);

        CREVerifier.ModelVote[3] memory votes;

        // Build votes based on outcome
        CREVerifier.VerdictOutcome voteA = outcome;
        CREVerifier.VerdictOutcome voteB = outcome;
        CREVerifier.VerdictOutcome voteC =
            consensusCount < 3 ? CREVerifier.VerdictOutcome.FAVOR_PARTY_B : outcome;

        votes[0] = CREVerifier.ModelVote({
            modelId: "claude-opus-4-6",
            vote: voteA,
            confidenceBps: 8750,
            reasoningHash: keccak256("claude reasoning")
        });
        votes[1] = CREVerifier.ModelVote({
            modelId: "gpt-4o",
            vote: voteB,
            confidenceBps: 8200,
            reasoningHash: keccak256("gpt4 reasoning")
        });
        votes[2] = CREVerifier.ModelVote({
            modelId: "mistral-large-2411",
            vote: voteC,
            confidenceBps: consensusCount >= 3 ? uint16(7900) : uint16(6000),
            reasoningHash: keccak256("mistral reasoning")
        });

        return CREVerifier.WorkflowVerdict({
            disputeId: disputeId,
            finalOutcome: outcome,
            modelVotes: votes,
            consensusCount: consensusCount,
            evidenceHashA: dispute.evidenceHashA,
            evidenceHashB: dispute.evidenceHashB,
            executedAt: block.timestamp,
            workflowRunId: keccak256(abi.encodePacked(disputeId, block.timestamp))
        });
    }

    function _signVerdict(CREVerifier.WorkflowVerdict memory verdict)
        internal
        view
        returns (bytes memory)
    {
        bytes32 verdictHash = verifier.computeVerdictHash(verdict);
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", verdictHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorPrivKey, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Dispute Creation
    // ─────────────────────────────────────────────────────────

    function test_CreateDispute_Success() public {
        vm.prank(alice);
        bytes32 disputeId = escrow.createDispute{value: DEPOSIT}(bob, "Test dispute");

        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        assertEq(d.partyA, alice);
        assertEq(d.partyB, bob);
        assertEq(d.amount, DEPOSIT);
        assertEq(uint8(d.status), uint8(IArbitrationRegistry.DisputeStatus.PENDING));
        assertEq(address(escrow).balance, DEPOSIT);
    }

    function test_CreateDispute_RevertsBelowMinDeposit() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(DisputeEscrow.InsufficientDeposit.selector, 0.001 ether, 0.005 ether)
        );
        escrow.createDispute{value: 0.001 ether}(bob, "Test");
    }

    function test_ActivateDispute_Success() public {
        bytes32 disputeId = _createAndActivateDispute();

        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        assertEq(uint8(d.status), uint8(IArbitrationRegistry.DisputeStatus.ACTIVE));
        assertEq(address(escrow).balance, DEPOSIT * 2);
    }

    function test_ActivateDispute_RevertsWrongAmount() public {
        vm.prank(alice);
        bytes32 disputeId = escrow.createDispute{value: DEPOSIT}(bob, "Test");

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(DisputeEscrow.DepositMismatch.selector, disputeId, DEPOSIT / 2, DEPOSIT)
        );
        escrow.depositAndActivate{value: DEPOSIT / 2}(disputeId);
    }

    function test_ActivateDispute_RevertsWrongCaller() public {
        vm.prank(alice);
        bytes32 disputeId = escrow.createDispute{value: DEPOSIT}(bob, "Test");

        address charlie = makeAddr("charlie");
        vm.deal(charlie, 1 ether);
        vm.prank(charlie);
        vm.expectRevert(
            abi.encodeWithSelector(DisputeEscrow.NotPartyB.selector, disputeId, charlie)
        );
        escrow.depositAndActivate{value: DEPOSIT}(disputeId);
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Evidence Submission
    // ─────────────────────────────────────────────────────────

    function test_SubmitEvidence_AutoTransitionsToInArbitration() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        assertEq(uint8(d.status), uint8(IArbitrationRegistry.DisputeStatus.IN_ARBITRATION));
        assert(d.evidenceHashA != bytes32(0));
        assert(d.evidenceHashB != bytes32(0));
    }

    function test_SubmitEvidence_RevertsNotParty() public {
        bytes32 disputeId = _createAndActivateDispute();
        address charlie = makeAddr("charlie");

        vm.prank(charlie);
        vm.expectRevert(abi.encodeWithSelector(ArbitrationRegistry.NotParty.selector, disputeId, charlie));
        registry.submitEvidence(disputeId, keccak256("charlie evidence"));
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Happy Path — Consensus Reached
    // ─────────────────────────────────────────────────────────

    function test_HappyPath_AliceWins() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        uint256 aliceBalanceBefore = alice.balance;
        uint256 treasuryBalanceBefore = treasury.balance;

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);
        bytes memory sig = _signVerdict(verdict);

        vm.expectEmit(true, false, false, false);
        emit CREVerifier.ConsensusReached(
            disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, alice, 3, bytes32(0), block.timestamp
        );

        verifier.submitVerdict(verdict, sig);

        // Alice gets (2 * DEPOSIT) - 1% fee
        uint256 totalFunds = DEPOSIT * 2;
        uint256 fee = (totalFunds * 100) / 10_000;
        uint256 expectedPayout = totalFunds - fee;

        assertEq(alice.balance, aliceBalanceBefore + expectedPayout);
        assertEq(treasury.balance, treasuryBalanceBefore + fee);
        assertEq(address(escrow).balance, 0);

        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        assertEq(uint8(d.status), uint8(IArbitrationRegistry.DisputeStatus.SETTLED));
        assertEq(d.winner, alice);
        assert(d.workflowOutputHash != bytes32(0));
    }

    function test_HappyPath_BobWins() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        uint256 bobBalanceBefore = bob.balance;

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_B, 3);
        bytes memory sig = _signVerdict(verdict);

        verifier.submitVerdict(verdict, sig);

        uint256 totalFunds = DEPOSIT * 2;
        uint256 fee = (totalFunds * 100) / 10_000;
        assertEq(bob.balance, bobBalanceBefore + (totalFunds - fee));
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Failure Modes (visible in demo)
    // ─────────────────────────────────────────────────────────

    function test_FailureMode_NoConsensus_TriggersRefund() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        uint256 aliceBalanceBefore = alice.balance;
        uint256 bobBalanceBefore = bob.balance;

        // Only 1 model agrees — below 2/3 threshold
        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 1);
        bytes memory sig = _signVerdict(verdict);

        vm.expectEmit(true, false, false, false);
        emit CREVerifier.ConsensusFailure(
            disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 1, 2, bytes32(0), block.timestamp
        );

        verifier.submitVerdict(verdict, sig);

        // Both parties refunded in full (no fee on refunds)
        assertEq(alice.balance, aliceBalanceBefore + DEPOSIT);
        assertEq(bob.balance, bobBalanceBefore + DEPOSIT);
        assertEq(address(escrow).balance, 0);

        IArbitrationRegistry.DisputeRecord memory d = registry.getDispute(disputeId);
        assertEq(uint8(d.status), uint8(IArbitrationRegistry.DisputeStatus.REFUNDED));
    }

    function test_FailureMode_CircuitBreaker() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        uint256 aliceBalanceBefore = alice.balance;
        uint256 bobBalanceBefore = bob.balance;

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.CIRCUIT_BREAKER, 0);
        bytes memory sig = _signVerdict(verdict);

        vm.expectEmit(true, false, false, false);
        emit CREVerifier.CircuitBreakerActivated(disputeId, "", bytes32(0), block.timestamp);

        verifier.submitVerdict(verdict, sig);

        assertEq(alice.balance, aliceBalanceBefore + DEPOSIT);
        assertEq(bob.balance, bobBalanceBefore + DEPOSIT);
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Security
    // ─────────────────────────────────────────────────────────

    function test_Security_InvalidSignatureReverts() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);

        // Sign with wrong key
        uint256 wrongKey = 0xBAD;
        bytes32 verdictHash = verifier.computeVerdictHash(verdict);
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", verdictHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(
            abi.encodeWithSelector(
                CREVerifier.InvalidSignature.selector, vm.addr(wrongKey), operatorAddr
            )
        );
        verifier.submitVerdict(verdict, badSig);
    }

    function test_Security_ReplayProtection() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);
        bytes memory sig = _signVerdict(verdict);

        verifier.submitVerdict(verdict, sig);

        // Second submission with same verdict hash should revert
        vm.expectRevert();
        verifier.submitVerdict(verdict, sig);
    }

    function test_Security_CannotDoubleSettle() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        // First settlement
        CREVerifier.WorkflowVerdict memory v1 =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);
        bytes memory s1 = _signVerdict(v1);
        verifier.submitVerdict(v1, s1);

        // Try to settle again with different verdict (different workflowRunId makes different hash)
        CREVerifier.WorkflowVerdict memory v2 = v1;
        v2.workflowRunId = keccak256("different");
        v2.executedAt = block.timestamp;
        bytes memory s2 = _signVerdict(v2);

        // Escrow already settled — should revert
        vm.expectRevert(abi.encodeWithSelector(DisputeEscrow.AlreadySettled.selector, disputeId));
        verifier.submitVerdict(v2, s2);
    }

    function test_Security_StaleVerdictReverts() public {
        // Warp forward so we can subtract time without underflow
        vm.warp(block.timestamp + 1 days);

        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);

        // Set verdict timestamp to 2 hours ago (past the 1-hour MAX_VERDICT_AGE)
        verdict.executedAt = block.timestamp - 2 hours;
        bytes memory sig = _signVerdict(verdict);

        vm.expectRevert(
            abi.encodeWithSelector(CREVerifier.VerdictTooOld.selector, verdict.executedAt, 1 hours)
        );
        verifier.submitVerdict(verdict, sig);
    }

    function test_Security_DirectEscrowCallReverts() public {
        bytes32 disputeId = _createAndActivateDispute();

        // Try to call executeVerdict directly (not through verifier)
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DisputeEscrow.NotCREVerifier.selector, alice));
        escrow.executeVerdict(disputeId, alice, bytes32(0));
    }

    function test_Security_DirectRegistryCallReverts() public {
        // Non-authorized address cannot register disputes
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArbitrationRegistry.NotAuthorized.selector, alice));
        registry.registerDispute(bytes32("test"), alice, bob, 1 ether, "attack");
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Evidence Integrity
    // ─────────────────────────────────────────────────────────

    function test_Security_EvidenceMismatchReverts() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);

        // Tamper with evidence hashes
        verdict.evidenceHashA = keccak256("wrong evidence");
        bytes memory sig = _signVerdict(verdict);

        vm.expectRevert(
            abi.encodeWithSelector(CREVerifier.EvidenceMismatch.selector, disputeId)
        );
        verifier.submitVerdict(verdict, sig);
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Fee Calculation
    // ─────────────────────────────────────────────────────────

    function test_FeeCalculation_CorrectlyDistributed() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        uint256 totalFunds = DEPOSIT * 2; // 0.2 ETH
        uint256 expectedFee = totalFunds / 100; // 1% = 0.002 ETH
        uint256 expectedPayout = totalFunds - expectedFee;

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.FAVOR_PARTY_A, 3);
        bytes memory sig = _signVerdict(verdict);

        verifier.submitVerdict(verdict, sig);

        assertEq(treasury.balance, expectedFee, "Treasury fee wrong");
        assertEq(address(escrow).balance, 0, "Escrow should be empty");
    }

    function test_FeeCalculation_NoFeeOnRefund() public {
        bytes32 disputeId = _createAndActivateDispute();
        _submitEvidence(disputeId);

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;

        CREVerifier.WorkflowVerdict memory verdict =
            _buildVerdict(disputeId, CREVerifier.VerdictOutcome.NO_CONSENSUS, 0);
        bytes memory sig = _signVerdict(verdict);
        verifier.submitVerdict(verdict, sig);

        // Full refund — no fee deducted
        assertEq(alice.balance, aliceBefore + DEPOSIT);
        assertEq(bob.balance, bobBefore + DEPOSIT);
        assertEq(treasury.balance, 0);
    }

    // ─────────────────────────────────────────────────────────
    // Tests: Fuzz
    // ─────────────────────────────────────────────────────────

    function testFuzz_CreateDispute_AnyValidAmount(uint256 amount) public {
        amount = bound(amount, 0.005 ether, 10 ether);

        vm.deal(alice, amount);
        vm.prank(alice);
        bytes32 disputeId = escrow.createDispute{value: amount}(bob, "Fuzz test");

        assertEq(escrow.getEscrow(disputeId).depositA, amount);
    }
}
