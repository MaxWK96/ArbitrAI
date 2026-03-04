// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DisputeEscrow} from "../src/DisputeEscrow.sol";
import {ArbitrationRegistry} from "../src/ArbitrationRegistry.sol";

/**
 * @title CreateDemoDispute
 * @notice Creates a dispute that stays in IN_ARBITRATION state for simulate demos.
 *
 * Runs steps 1–4 of the dispute lifecycle (skips submitVerdict), leaving
 * the dispute in IN_ARBITRATION so the CRE workflow can process it.
 *
 * Usage:
 *   forge script script/CreateDemoDispute.s.sol:CreateDemoDispute \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --broadcast -vvvv
 *
 * Outputs the dispute ID — set it as DISPUTE_ID in cre-workflow/.env.
 */
contract CreateDemoDispute is Script {
    DisputeEscrow escrow;
    ArbitrationRegistry registry;

    uint256 constant DEPOSIT = 0.01 ether;

    function run() external {
        escrow   = DisputeEscrow(payable(vm.envAddress("ESCROW_ADDRESS")));
        registry = ArbitrationRegistry(vm.envAddress("REGISTRY_ADDRESS"));

        uint256 partyAKey = vm.envUint("PARTY_A_PRIVATE_KEY");
        uint256 partyBKey = vm.envUint("PARTY_B_PRIVATE_KEY");
        address partyA    = vm.addr(partyAKey);
        address partyB    = vm.addr(partyBKey);

        // Step 1: Party A creates dispute
        vm.startBroadcast(partyAKey);
        bytes32 disputeId = escrow.createDispute{value: DEPOSIT}(
            partyB,
            "Demo dispute: Alice built a landing page. Bob questions the deliverable quality."
        );
        vm.stopBroadcast();

        console.log("Dispute created:");
        console.logBytes32(disputeId);

        // Step 2: Party B deposits to activate
        vm.startBroadcast(partyBKey);
        escrow.depositAndActivate{value: DEPOSIT}(disputeId);
        vm.stopBroadcast();

        // Step 3: Both parties submit evidence hashes
        // These are keccak256 hashes of the actual evidence content
        // (real content is stored on the evidence server, only hash goes on-chain)
        bytes32 evidenceHashA = keccak256(
            "Alice evidence: GitHub repo link, design file, client sign-off email."
        );
        bytes32 evidenceHashB = keccak256(
            "Bob evidence: Screenshot of broken mobile layout, missing accessibility features."
        );

        vm.startBroadcast(partyAKey);
        registry.submitEvidence(disputeId, evidenceHashA);
        vm.stopBroadcast();

        vm.startBroadcast(partyBKey);
        registry.submitEvidence(disputeId, evidenceHashB);
        vm.stopBroadcast();

        console.log("Dispute is now IN_ARBITRATION. Set in cre-workflow/.env:");
        console.log("DISPUTE_ID=");
        console.logBytes32(disputeId);
    }
}
