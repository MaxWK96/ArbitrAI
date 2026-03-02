// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DisputeEscrow} from "../src/DisputeEscrow.sol";
import {ArbitrationRegistry} from "../src/ArbitrationRegistry.sol";
import {CREVerifier} from "../src/CREVerifier.sol";

/**
 * @title Deploy
 * @notice Deploys and wires all ArbitrAI contracts atomically.
 *
 * Deployment order (matches user spec):
 *   1. DisputeEscrow       — holds ETH, needs treasury address
 *   2. ArbitrationRegistry — audit trail, no deps
 *   3. CREVerifier         — trust bridge, needs operator key
 *
 * Then wires all three together.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:Deploy \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $ETHERSCAN_API_KEY \
 *     -vvvv
 *
 * Required env vars:
 *   DEPLOYER_PRIVATE_KEY   — deployer key (must have Sepolia ETH)
 *   CRE_OPERATOR_ADDRESS   — address whose key the CRE workflow uses to sign verdicts
 *   ETHERSCAN_API_KEY      — for --verify flag
 *   TREASURY_ADDRESS       — (optional) defaults to deployer
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployerAddr = vm.addr(deployerKey);
        address creOperator = vm.envAddress("CRE_OPERATOR_ADDRESS");
        address treasury = vm.envOr("TREASURY_ADDRESS", deployerAddr);

        console.log("========================================");
        console.log("     ArbitrAI Deployment - Sepolia      ");
        console.log("========================================");
        console.log("Deployer:     ", deployerAddr);
        console.log("CRE Operator: ", creOperator);
        console.log("Treasury:     ", treasury);
        console.log("Chain ID:     ", block.chainid);
        console.log("----------------------------------------");

        require(block.chainid == 11155111, "Must deploy on Sepolia (chainId 11155111)");

        vm.startBroadcast(deployerKey);

        // ── 1. DisputeEscrow ───────────────────────────────────────────────
        DisputeEscrow escrow = new DisputeEscrow(treasury);
        console.log("[1/3] DisputeEscrow deployed:       ", address(escrow));

        // ── 2. ArbitrationRegistry ────────────────────────────────────────
        ArbitrationRegistry registry = new ArbitrationRegistry();
        console.log("[2/3] ArbitrationRegistry deployed: ", address(registry));

        // ── 3. CREVerifier ────────────────────────────────────────────────
        CREVerifier verifier = new CREVerifier(creOperator);
        console.log("[3/3] CREVerifier deployed:         ", address(verifier));

        // ── Wire up ───────────────────────────────────────────────────────
        // Registry authorizes escrow (to call registerDispute/updateStatus)
        registry.setAuthorized(address(escrow), true);
        // Registry authorizes verifier (to call recordWorkflowOutput/updateStatus)
        registry.setAuthorized(address(verifier), true);
        // Escrow knows where to register disputes and who can trigger settlement
        escrow.setContracts(address(registry), address(verifier));
        // Verifier knows where to trigger escrow settlement and read registry
        verifier.setContracts(address(escrow), address(registry));

        vm.stopBroadcast();

        // ── Output ────────────────────────────────────────────────────────
        console.log("----------------------------------------");
        console.log("Wiring complete. All contracts connected.");
        console.log("========================================");
        console.log("\nEtherscan links:");
        console.log(string.concat("  DisputeEscrow:       https://sepolia.etherscan.io/address/", vm.toString(address(escrow))));
        console.log(string.concat("  ArbitrationRegistry: https://sepolia.etherscan.io/address/", vm.toString(address(registry))));
        console.log(string.concat("  CREVerifier:         https://sepolia.etherscan.io/address/", vm.toString(address(verifier))));

        // Write deployments.json — picked up by frontend/.env setup script
        string memory json = string.concat(
            "{\n",
            '  "network": "sepolia",\n',
            '  "chainId": 11155111,\n',
            '  "deployer": "', vm.toString(deployerAddr), '",\n',
            '  "creOperator": "', vm.toString(creOperator), '",\n',
            '  "treasury": "', vm.toString(treasury), '",\n',
            '  "contracts": {\n',
            '    "DisputeEscrow": "', vm.toString(address(escrow)), '",\n',
            '    "ArbitrationRegistry": "', vm.toString(address(registry)), '",\n',
            '    "CREVerifier": "', vm.toString(address(verifier)), '"\n',
            "  }\n",
            "}"
        );
        vm.writeFile("../deployments.json", json);
        console.log("\nAddresses written to deployments.json");
    }
}
