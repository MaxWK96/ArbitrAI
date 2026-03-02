// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DisputeEscrow} from "../src/DisputeEscrow.sol";
import {ArbitrationRegistry} from "../src/ArbitrationRegistry.sol";
import {CREVerifier} from "../src/CREVerifier.sol";

/**
 * @title Smoke
 * @notice Post-deployment sanity checks — confirms all contracts are live and
 *         correctly wired without sending any transactions.
 *
 * Usage:
 *   forge script script/Smoke.s.sol:Smoke \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     -vvv
 *
 * Required env vars:
 *   ESCROW_ADDRESS     REGISTRY_ADDRESS     VERIFIER_ADDRESS
 */
contract Smoke is Script {
    function run() external view {
        address escrowAddr   = vm.envAddress("ESCROW_ADDRESS");
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");
        address verifierAddr = vm.envAddress("VERIFIER_ADDRESS");
        address creOperator  = vm.envAddress("CRE_OPERATOR_ADDRESS");

        DisputeEscrow escrow     = DisputeEscrow(payable(escrowAddr));
        ArbitrationRegistry reg  = ArbitrationRegistry(registryAddr);
        CREVerifier ver          = CREVerifier(verifierAddr);

        console.log("========================================");
        console.log("     ArbitrAI Smoke Test - Sepolia      ");
        console.log("========================================");

        // ── DisputeEscrow checks ──────────────────────────────────────────
        address escrowRegistry = address(escrow.registry());
        address escrowVerifier = escrow.creVerifier();
        console.log("[DisputeEscrow]");
        console.log("  address:     ", escrowAddr);
        console.log("  registry:    ", escrowRegistry);
        console.log("  creVerifier: ", escrowVerifier);
        console.log("  MIN_DEPOSIT: ", escrow.MIN_DEPOSIT());
        require(escrowRegistry == registryAddr, "FAIL: escrow.registry != deployed registry");
        require(escrowVerifier == verifierAddr, "FAIL: escrow.creVerifier != deployed verifier");
        console.log("  [PASS] wiring correct");

        // ── ArbitrationRegistry checks ────────────────────────────────────
        bool escrowAuthorized    = reg.authorized(escrowAddr);
        bool verifierAuthorized  = reg.authorized(verifierAddr);
        uint256 disputeCount     = reg.disputeCount();
        console.log("[ArbitrationRegistry]");
        console.log("  address:           ", registryAddr);
        console.log("  escrow authorized: ", escrowAuthorized);
        console.log("  verifier authorized:", verifierAuthorized);
        console.log("  dispute count:     ", disputeCount);
        require(escrowAuthorized,   "FAIL: escrow not authorized in registry");
        require(verifierAuthorized, "FAIL: verifier not authorized in registry");
        console.log("  [PASS] wiring correct");

        // ── CREVerifier checks ────────────────────────────────────────────
        address verEscrow    = address(ver.escrow());
        address verRegistry  = address(ver.registry());
        address verOperator  = ver.creOperator();
        uint8   threshold    = ver.consensusThreshold();
        console.log("[CREVerifier]");
        console.log("  address:    ", verifierAddr);
        console.log("  escrow:     ", verEscrow);
        console.log("  registry:   ", verRegistry);
        console.log("  operator:   ", verOperator);
        console.log("  threshold:  ", threshold);
        require(verEscrow == escrowAddr,     "FAIL: verifier.escrow != deployed escrow");
        require(verRegistry == registryAddr, "FAIL: verifier.registry != deployed registry");
        require(verOperator == creOperator,  "FAIL: verifier.creOperator != env CRE_OPERATOR_ADDRESS");
        require(threshold == 2,              "FAIL: consensus threshold should be 2");
        console.log("  [PASS] wiring correct");

        console.log("----------------------------------------");
        console.log("ALL SMOKE TESTS PASSED");
        console.log("========================================");
    }
}
