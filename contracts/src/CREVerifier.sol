// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IDisputeEscrow} from "./interfaces/IDisputeEscrow.sol";
import {IArbitrationRegistry} from "./interfaces/IArbitrationRegistry.sol";

/**
 * @title CREVerifier
 * @notice Trust bridge between Chainlink CRE's off-chain AI consensus and on-chain settlement.
 *
 * @dev Architecture overview:
 *
 *   [CRE Workflow] ──signs verdict──► [CREVerifier] ──calls──► [DisputeEscrow]
 *                                            │
 *                                     ECDSA verify
 *                                     against operator key
 *
 * The CRE workflow runs off-chain in Chainlink's verifiable execution environment.
 * It fetches evidence via Confidential HTTP (never on-chain), queries 3 AI models,
 * applies 2/3 consensus, then signs the aggregated verdict with the operator key.
 *
 * This contract verifies that signature before executing any settlement.
 * There is NO way to trigger fund release without a valid CRE operator signature.
 *
 * Prize tracks:
 *  - CRE & AI: This IS the Chainlink CRE integration — AI outputs verified on-chain
 *  - Privacy: Evidence hashes verified without evidence ever appearing on-chain
 *  - Risk & Compliance: Full audit trail, replay protection, consensus threshold enforcement
 *  - AI Agents: 3-model consensus with confidence scores and branching logic on-chain
 */
contract CREVerifier is Ownable, Pausable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ─────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────

    enum VerdictOutcome {
        FAVOR_PARTY_A,          // ≥2 models: party A wins
        FAVOR_PARTY_B,          // ≥2 models: party B wins
        INSUFFICIENT_EVIDENCE,  // Models agreed: not enough evidence to decide
        NO_CONSENSUS,           // Models disagree — below 2/3 threshold
        CIRCUIT_BREAKER         // Model failure, timeout, or malformed response
    }

    /// @notice Individual vote from one AI model
    struct ModelVote {
        string modelId;         // e.g. "claude-opus-4-6", "gpt-4o", "mistral-large-2411"
        VerdictOutcome vote;
        uint16 confidenceBps;   // Confidence in basis points (0-10000, e.g. 8750 = 87.5%)
        bytes32 reasoningHash;  // Keccak256 of the model's reasoning text (stored in CRE logs)
    }

    /// @notice Complete aggregated verdict from the CRE workflow
    struct WorkflowVerdict {
        bytes32 disputeId;
        VerdictOutcome finalOutcome;
        ModelVote[3] modelVotes;         // Exactly 3 models, always
        uint8 consensusCount;            // How many models voted for finalOutcome (2 or 3)
        bytes32 evidenceHashA;           // Confirms which evidence was evaluated
        bytes32 evidenceHashB;
        uint256 executedAt;              // CRE workflow execution timestamp
        bytes32 workflowRunId;           // Unique CRE workflow run ID for cross-referencing
    }

    // ─────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────

    IDisputeEscrow public escrow;
    IArbitrationRegistry public registry;

    /// @notice The Ethereum address corresponding to the CRE workflow's signing key.
    ///         Only verdicts signed by this key can trigger settlement.
    ///         Set to the CRE operator address at deployment; updatable by owner (multisig).
    address public creOperator;

    /// @notice 2-of-3 models must agree for consensus (configurable but default 2)
    uint8 public consensusThreshold;

    /// @notice Replay protection — each verdict hash can only be used once
    mapping(bytes32 => bool) public processedVerdicts;

    /// @notice Complete verdict records for audit trail
    mapping(bytes32 => WorkflowVerdict) public verdicts;

    // ─────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────

    /// @dev Emitted for each model's vote — frontend shows these one by one
    event ModelVoteRecorded(
        bytes32 indexed disputeId,
        string modelId,
        VerdictOutcome vote,
        uint16 confidenceBps,
        uint256 timestamp
    );

    event ConsensusReached(
        bytes32 indexed disputeId,
        VerdictOutcome outcome,
        address winner,
        uint8 consensusCount,
        bytes32 workflowRunId,
        uint256 timestamp
    );

    /// @dev Emitted when models disagree — triggers refund flow
    event ConsensusFailure(
        bytes32 indexed disputeId,
        VerdictOutcome outcome,
        uint8 consensusCount,
        uint8 required,
        bytes32 workflowRunId,
        uint256 timestamp
    );

    /// @dev Emitted when a model fails / times out — circuit breaker triggers refund
    event CircuitBreakerActivated(
        bytes32 indexed disputeId,
        string reason,
        bytes32 workflowRunId,
        uint256 timestamp
    );

    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event ThresholdUpdated(uint8 oldThreshold, uint8 newThreshold);

    // ─────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────

    error InvalidSignature(address recovered, address expected);
    error VerdictAlreadyProcessed(bytes32 verdictHash);
    error EvidenceMismatch(bytes32 disputeId);
    error ZeroAddress();
    error InvalidThreshold(uint8 provided);
    error VerdictTooOld(uint256 executedAt, uint256 maxAge);

    // ─────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────

    /// @notice Verdicts older than 1 hour are rejected (prevents delayed submission attacks)
    uint256 public constant MAX_VERDICT_AGE = 1 hours;

    // ─────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────

    constructor(address _creOperator) Ownable(msg.sender) {
        if (_creOperator == address(0)) revert ZeroAddress();
        creOperator = _creOperator;
        consensusThreshold = 2; // 2-of-3 by default
    }

    // ─────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────

    function setContracts(address _escrow, address _registry) external onlyOwner {
        if (_escrow == address(0) || _registry == address(0)) revert ZeroAddress();
        escrow = IDisputeEscrow(_escrow);
        registry = IArbitrationRegistry(_registry);
    }

    function updateOperator(address newOperator) external onlyOwner {
        if (newOperator == address(0)) revert ZeroAddress();
        emit OperatorUpdated(creOperator, newOperator);
        creOperator = newOperator;
    }

    function updateThreshold(uint8 newThreshold) external onlyOwner {
        if (newThreshold == 0 || newThreshold > 3) revert InvalidThreshold(newThreshold);
        emit ThresholdUpdated(consensusThreshold, newThreshold);
        consensusThreshold = newThreshold;
    }

    // ─────────────────────────────────────────────────────────
    // Core: Verdict Submission
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Submit a verified CRE workflow verdict to trigger settlement
     * @param verdict  The complete aggregated verdict from the CRE workflow
     * @param signature ECDSA signature over the verdict hash, produced by the CRE operator key
     *
     * @dev Security checks in order:
     *      1. Verdict not too old (replay / staleness protection)
     *      2. Compute deterministic hash of all verdict fields
     *      3. Replay protection (each hash used exactly once)
     *      4. ECDSA signature verification against creOperator address
     *      5. Evidence integrity check (hashes must match what's in registry)
     *      6. Consensus threshold enforcement
     *      7. Settlement execution
     *
     * The signature requirement means: even if this contract is called directly
     * by anyone, they cannot produce a valid signature without the CRE operator key.
     * This key lives only inside the Chainlink CRE execution environment.
     */
    function submitVerdict(WorkflowVerdict calldata verdict, bytes calldata signature)
        external
        whenNotPaused
    {
        // 1. Staleness check — CRE must submit promptly
        if (block.timestamp > verdict.executedAt + MAX_VERDICT_AGE) {
            revert VerdictTooOld(verdict.executedAt, MAX_VERDICT_AGE);
        }

        // 2. Compute the canonical verdict hash
        bytes32 verdictHash = _computeVerdictHash(verdict);

        // 3. Replay protection
        if (processedVerdicts[verdictHash]) {
            revert VerdictAlreadyProcessed(verdictHash);
        }

        // 4. Verify CRE operator signature
        address signer = verdictHash.toEthSignedMessageHash().recover(signature);
        if (signer != creOperator) {
            revert InvalidSignature(signer, creOperator);
        }

        // 5. Evidence integrity — confirm CRE evaluated the correct evidence
        IArbitrationRegistry.DisputeRecord memory dispute = registry.getDispute(verdict.disputeId);
        if (
            dispute.evidenceHashA != verdict.evidenceHashA
                || dispute.evidenceHashB != verdict.evidenceHashB
        ) {
            revert EvidenceMismatch(verdict.disputeId);
        }

        // 6. Mark verdict processed (before external calls — CEI pattern)
        processedVerdicts[verdictHash] = true;
        verdicts[verdict.disputeId] = verdict;

        // 7. Emit individual model votes for the frontend to show one-by-one
        for (uint256 i = 0; i < 3; i++) {
            emit ModelVoteRecorded(
                verdict.disputeId,
                verdict.modelVotes[i].modelId,
                verdict.modelVotes[i].vote,
                verdict.modelVotes[i].confidenceBps,
                block.timestamp
            );
        }

        // 8. Execute settlement
        _executeSettlement(verdict, verdictHash, dispute);
    }

    // ─────────────────────────────────────────────────────────
    // Internal Settlement Logic
    // ─────────────────────────────────────────────────────────

    function _executeSettlement(
        WorkflowVerdict calldata verdict,
        bytes32 proofHash,
        IArbitrationRegistry.DisputeRecord memory dispute
    ) internal {
        VerdictOutcome outcome = verdict.finalOutcome;

        // Circuit breaker — model failure
        if (outcome == VerdictOutcome.CIRCUIT_BREAKER) {
            emit CircuitBreakerActivated(
                verdict.disputeId, "AI model failure or timeout", verdict.workflowRunId, block.timestamp
            );
            escrow.executeRefund(
                verdict.disputeId, proofHash, "Circuit breaker: AI model failure or timeout"
            );
            return;
        }

        // Check consensus threshold
        if (verdict.consensusCount < consensusThreshold) {
            emit ConsensusFailure(
                verdict.disputeId,
                outcome,
                verdict.consensusCount,
                consensusThreshold,
                verdict.workflowRunId,
                block.timestamp
            );
            escrow.executeRefund(
                verdict.disputeId,
                proofHash,
                string.concat(
                    "No consensus: only ",
                    _uint8ToString(verdict.consensusCount),
                    " of 3 models agreed"
                )
            );
            return;
        }

        // No consensus outcome types trigger refund regardless of count
        if (
            outcome == VerdictOutcome.INSUFFICIENT_EVIDENCE
                || outcome == VerdictOutcome.NO_CONSENSUS
        ) {
            emit ConsensusFailure(
                verdict.disputeId,
                outcome,
                verdict.consensusCount,
                consensusThreshold,
                verdict.workflowRunId,
                block.timestamp
            );
            escrow.executeRefund(verdict.disputeId, proofHash, "Insufficient evidence to decide");
            return;
        }

        // Consensus reached — determine winner
        address winner;
        if (outcome == VerdictOutcome.FAVOR_PARTY_A) {
            winner = dispute.partyA;
        } else if (outcome == VerdictOutcome.FAVOR_PARTY_B) {
            winner = dispute.partyB;
        }

        emit ConsensusReached(
            verdict.disputeId,
            outcome,
            winner,
            verdict.consensusCount,
            verdict.workflowRunId,
            block.timestamp
        );

        escrow.executeVerdict(verdict.disputeId, winner, proofHash);
    }

    // ─────────────────────────────────────────────────────────
    // Hash Computation
    // ─────────────────────────────────────────────────────────

    /**
     * @notice Computes a deterministic hash of all verdict fields.
     *         Any modification to the verdict data invalidates the CRE operator signature.
     */
    function _computeVerdictHash(WorkflowVerdict calldata v) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                v.disputeId,
                v.finalOutcome,
                // Model 0
                v.modelVotes[0].modelId,
                v.modelVotes[0].vote,
                v.modelVotes[0].confidenceBps,
                v.modelVotes[0].reasoningHash,
                // Model 1
                v.modelVotes[1].modelId,
                v.modelVotes[1].vote,
                v.modelVotes[1].confidenceBps,
                v.modelVotes[1].reasoningHash,
                // Model 2
                v.modelVotes[2].modelId,
                v.modelVotes[2].vote,
                v.modelVotes[2].confidenceBps,
                v.modelVotes[2].reasoningHash,
                v.consensusCount,
                v.evidenceHashA,
                v.evidenceHashB,
                v.executedAt,
                v.workflowRunId
            )
        );
    }

    /// @dev Expose hash computation for CRE workflow to use in signing
    function computeVerdictHash(WorkflowVerdict calldata v) external pure returns (bytes32) {
        return _computeVerdictHash(v);
    }

    // ─────────────────────────────────────────────────────────
    // View
    // ─────────────────────────────────────────────────────────

    function getVerdict(bytes32 disputeId) external view returns (WorkflowVerdict memory) {
        return verdicts[disputeId];
    }

    // ─────────────────────────────────────────────────────────
    // Utilities
    // ─────────────────────────────────────────────────────────

    function _uint8ToString(uint8 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        if (value == 1) return "1";
        if (value == 2) return "2";
        if (value == 3) return "3";
        return "?";
    }

    // ─────────────────────────────────────────────────────────
    // Emergency
    // ─────────────────────────────────────────────────────────

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
