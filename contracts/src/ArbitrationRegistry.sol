// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IArbitrationRegistry} from "./interfaces/IArbitrationRegistry.sol";

/**
 * @title ArbitrationRegistry
 * @notice Central registry tracking every ArbitrAI dispute from creation to settlement.
 *         All state transitions emit on-chain events that form an immutable audit trail.
 *
 * @dev Why this exists as a separate contract:
 *      - Separation of concerns: escrow holds money, registry holds truth
 *      - Upgradeability: registry can be pointed to new escrow/verifier without losing history
 *      - Compliance: every action timestamped and queryable on-chain
 *
 * Prize tracks:
 *  - Risk & Compliance: complete on-chain audit trail of every dispute state change
 *  - CRE & AI: records verifiable CRE workflow output hashes
 */
contract ArbitrationRegistry is IArbitrationRegistry, Ownable, Pausable {
    // ─────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────

    /// @notice All dispute records keyed by disputeId
    mapping(bytes32 => DisputeRecord) private _disputes;

    /// @notice All disputeIds a given address is party to
    mapping(address => bytes32[]) private _partyDisputes;

    /// @notice Authorized callers (escrow contract + CRE verifier)
    mapping(address => bool) public authorized;

    /// @notice Total number of disputes ever created
    uint256 public disputeCount;

    // ─────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────

    event DisputeRegistered(
        bytes32 indexed disputeId,
        address indexed partyA,
        address indexed partyB,
        uint256 amount,
        string description,
        uint256 timestamp
    );

    event StatusUpdated(
        bytes32 indexed disputeId,
        DisputeStatus oldStatus,
        DisputeStatus newStatus,
        uint256 timestamp
    );

    event EvidenceSubmitted(
        bytes32 indexed disputeId,
        address indexed party,
        bytes32 evidenceHash,
        uint256 timestamp
    );

    /// @dev Emitted when CRE workflow output hash is recorded - provides verifiable link
    ///      between off-chain AI computation and on-chain settlement
    event WorkflowOutputRecorded(
        bytes32 indexed disputeId,
        bytes32 outputHash,
        address winner, // address(0) if refunded
        uint256 timestamp
    );

    event AuthorizationUpdated(address indexed account, bool authorized);

    // ─────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────

    error DisputeNotFound(bytes32 disputeId);
    error DisputeAlreadyExists(bytes32 disputeId);
    error InvalidStatus(bytes32 disputeId, DisputeStatus current, DisputeStatus required);
    error NotAuthorized(address caller);
    error NotParty(bytes32 disputeId, address caller);

    // ─────────────────────────────────────────────────────────
    // Modifiers
    // ─────────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        if (!authorized[msg.sender]) revert NotAuthorized(msg.sender);
        _;
    }

    modifier disputeExists(bytes32 disputeId) {
        if (_disputes[disputeId].status == DisputeStatus.NONE) {
            revert DisputeNotFound(disputeId);
        }
        _;
    }

    // ─────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────

    /// @notice Authorize or deauthorize a contract (escrow or verifier)
    function setAuthorized(address account, bool isAuthorized) external onlyOwner {
        authorized[account] = isAuthorized;
        emit AuthorizationUpdated(account, isAuthorized);
    }

    // ─────────────────────────────────────────────────────────
    // Core Functions
    // ─────────────────────────────────────────────────────────

    /// @inheritdoc IArbitrationRegistry
    function registerDispute(
        bytes32 disputeId,
        address partyA,
        address partyB,
        uint256 amount,
        string calldata description
    ) external override onlyAuthorized whenNotPaused {
        if (_disputes[disputeId].status != DisputeStatus.NONE) {
            revert DisputeAlreadyExists(disputeId);
        }

        _disputes[disputeId] = DisputeRecord({
            id: disputeId,
            partyA: partyA,
            partyB: partyB,
            amount: amount,
            status: DisputeStatus.PENDING,
            evidenceHashA: bytes32(0),
            evidenceHashB: bytes32(0),
            workflowOutputHash: bytes32(0),
            createdAt: block.timestamp,
            settledAt: 0,
            winner: address(0),
            description: description
        });

        _partyDisputes[partyA].push(disputeId);
        _partyDisputes[partyB].push(disputeId);
        disputeCount++;

        emit DisputeRegistered(disputeId, partyA, partyB, amount, description, block.timestamp);
    }

    /// @inheritdoc IArbitrationRegistry
    function updateStatus(bytes32 disputeId, DisputeStatus newStatus)
        external
        override
        onlyAuthorized
        disputeExists(disputeId)
    {
        DisputeStatus oldStatus = _disputes[disputeId].status;
        _disputes[disputeId].status = newStatus;
        emit StatusUpdated(disputeId, oldStatus, newStatus, block.timestamp);
    }

    /// @notice Submit an evidence hash - callable by either party during ACTIVE status
    /// @dev The actual evidence is submitted via Chainlink Confidential HTTP and never
    ///      appears on-chain. Only the hash is stored here for verification integrity.
    function submitEvidence(bytes32 disputeId, bytes32 evidenceHash)
        external
        override
        disputeExists(disputeId)
        whenNotPaused
    {
        DisputeRecord storage dispute = _disputes[disputeId];

        if (dispute.status != DisputeStatus.ACTIVE) {
            revert InvalidStatus(disputeId, dispute.status, DisputeStatus.ACTIVE);
        }

        if (msg.sender == dispute.partyA) {
            dispute.evidenceHashA = evidenceHash;
        } else if (msg.sender == dispute.partyB) {
            dispute.evidenceHashB = evidenceHash;
        } else {
            revert NotParty(disputeId, msg.sender);
        }

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash, block.timestamp);

        // If both parties submitted evidence, automatically transition to IN_ARBITRATION
        // This signals the CRE workflow to begin processing
        if (dispute.evidenceHashA != bytes32(0) && dispute.evidenceHashB != bytes32(0)) {
            DisputeStatus old = dispute.status;
            dispute.status = DisputeStatus.IN_ARBITRATION;
            emit StatusUpdated(disputeId, old, DisputeStatus.IN_ARBITRATION, block.timestamp);
        }
    }

    /// @inheritdoc IArbitrationRegistry
    function recordWorkflowOutput(bytes32 disputeId, bytes32 outputHash, address winner)
        external
        override
        onlyAuthorized
        disputeExists(disputeId)
    {
        DisputeRecord storage dispute = _disputes[disputeId];
        dispute.workflowOutputHash = outputHash;

        if (winner != address(0)) {
            dispute.winner = winner;
            dispute.status = DisputeStatus.SETTLED;
            dispute.settledAt = block.timestamp;
        } else {
            dispute.status = DisputeStatus.REFUNDED;
        }

        emit WorkflowOutputRecorded(disputeId, outputHash, winner, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────

    /// @inheritdoc IArbitrationRegistry
    function getDispute(bytes32 disputeId) external view override returns (DisputeRecord memory) {
        return _disputes[disputeId];
    }

    /// @inheritdoc IArbitrationRegistry
    function getPartyDisputes(address party) external view override returns (bytes32[] memory) {
        return _partyDisputes[party];
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
