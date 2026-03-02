// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDisputeEscrow
/// @notice Interface for the escrow contract that holds funds during arbitration
interface IDisputeEscrow {
    struct EscrowRecord {
        address partyA;
        address partyB;
        uint256 depositA;
        uint256 depositB;
        bool partyADeposited;
        bool partyBDeposited;
        bool settled;
    }

    function createDispute(address partyB, string calldata description)
        external
        payable
        returns (bytes32 disputeId);

    function depositAndActivate(bytes32 disputeId) external payable;

    function executeVerdict(bytes32 disputeId, address winner, bytes32 proofHash) external;

    function executeRefund(bytes32 disputeId, bytes32 proofHash, string calldata reason) external;

    function getEscrow(bytes32 disputeId) external view returns (EscrowRecord memory);
}
