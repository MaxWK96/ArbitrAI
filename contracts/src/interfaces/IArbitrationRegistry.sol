// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IArbitrationRegistry
/// @notice Interface for the central dispute registry
interface IArbitrationRegistry {
    enum DisputeStatus {
        NONE,           // Dispute doesn't exist
        PENDING,        // Created, waiting for party B to deposit
        ACTIVE,         // Both deposited, evidence submission open
        IN_ARBITRATION, // CRE workflow is processing
        SETTLED,        // Verdict reached and enforced on-chain
        REFUNDED,       // No consensus, funds returned to both parties
        ESCALATED       // Flagged for human review
    }

    struct DisputeRecord {
        bytes32 id;
        address partyA;
        address partyB;
        uint256 amount;          // per-party deposit in wei
        DisputeStatus status;
        bytes32 evidenceHashA;   // hash of party A's encrypted evidence (content via Confidential HTTP)
        bytes32 evidenceHashB;   // hash of party B's encrypted evidence
        bytes32 workflowOutputHash; // hash of CRE workflow output for audit
        uint256 createdAt;
        uint256 settledAt;
        address winner;          // address(0) if refunded
        string description;      // public dispute description
    }

    function registerDispute(
        bytes32 disputeId,
        address partyA,
        address partyB,
        uint256 amount,
        string calldata description
    ) external;

    function updateStatus(bytes32 disputeId, DisputeStatus newStatus) external;

    function submitEvidence(bytes32 disputeId, bytes32 evidenceHash) external;

    function recordWorkflowOutput(bytes32 disputeId, bytes32 outputHash, address winner) external;

    function getDispute(bytes32 disputeId) external view returns (DisputeRecord memory);

    function getPartyDisputes(address party) external view returns (bytes32[] memory);
}
