# ArbitrAI — Deployed Contract Addresses (Sepolia)

> Network: Ethereum Sepolia Testnet (chainId: 11155111)
> Deployed: 2026-03-02
> Deployer: `0x9F485BDeaDF587D0ec699350CE5d6F9248750229`
> CRE Operator: `0x9F485BDeaDF587D0ec699350CE5d6F9248750229`
> Treasury: `0x9F485BDeaDF587D0ec699350CE5d6F9248750229`

---

## Contracts

### DisputeEscrow
Holds ETH during arbitration. Funds can ONLY be released via a verified CRE workflow verdict.

- **Address**: `0x4829dB4D2f4161BE292D51e1FDc5fe8B08b0bc16`
- **Etherscan**: https://sepolia.etherscan.io/address/0x4829dB4D2f4161BE292D51e1FDc5fe8B08b0bc16
- **MIN_DEPOSIT**: 0.005 ETH
- **PROTOCOL_FEE_BPS**: 100 (1%)

### ArbitrationRegistry
Immutable on-chain audit trail. Records every state transition, evidence hash, and workflow output.

- **Address**: `0x2c4aa262a89C3559A4764e52E2f50b9cDacE395F`
- **Etherscan**: https://sepolia.etherscan.io/address/0x2c4aa262a89C3559A4764e52E2f50b9cDacE395F

### CREVerifier
Trust bridge between Chainlink CRE and escrow settlement. Verifies ECDSA operator signature and enforces 2/3 model consensus.

- **Address**: `0xAa99Aa0F7C2C5A010f685002AD5F166271ac3a3b`
- **Etherscan**: https://sepolia.etherscan.io/address/0xAa99Aa0F7C2C5A010f685002AD5F166271ac3a3b
- **Consensus Threshold**: 2/3 models
- **Max Verdict Age**: 1 hour (staleness protection)
- **creOperator**: `0x9F485BDeaDF587D0ec699350CE5d6F9248750229`

---

## E2E Test Transactions (Sepolia) — 2026-03-02

### Scenario A — Happy Path (Alice wins, 3/3 consensus)
- **Dispute ID**: `0x2c4c798cbe05c34f71e541789a06e2fa1e8dac39c36636b1c47ebf3af6df1765`
- Party A (Alice): `0xaC266469bB463Ec83E2D6845e513d47B191739B0`
- Party B (Bob): `0xEe6cadE823BB01321Fa753FC0E89bd9402A04Dd7`
- Outcome: FAVOR_PARTY_A — Alice received 0.0198 ETH (0.02 pool - 1% fee)
- Protocol fee: 0.0002 ETH to treasury
- Escrow cleared: 0 balance after settlement

| Step | Function | Tx Hash |
|------|----------|---------|
| 1 | `createDispute` | `0x0c95b1a80525d24485f66a693b2611a0b4270f909c47e1dbf0d418b371c2c974` |
| 2 | `depositAndActivate` | `0x9d3231f7a003db6be954b27ca0e741c9ec49c5c5492da86b3d1c76767b656b01` |
| 3 | `submitEvidence` (A) | `0x02a51b9ba22a3136eb176c71f852812c1a6ecc96c7ca0e641cc66db5da92fa30` |
| 4 | `submitEvidence` (B) | `0xdab35d6e15a0e5958894dbf0a3b08ee6f268e0bf30b86f1b86cc3fe56bb69afd` |
| 5 | **`submitVerdict`** | **`0x6afb5848100fb7ae4f0e9e390715eda1b399a941237f2b7afeb9e7c570982af2`** |

### Scenario B — Failure Mode (no consensus, full refund)
- Outcome: NO_CONSENSUS — circuit breaker activated, both parties refunded 0.01 ETH each
- No fee taken on refunds
- Escrow cleared: 0 balance after refund

| Step | Function | Tx Hash |
|------|----------|---------|
| 1 | `createDispute` | `0x638eca2c9089dd997c5172d04f2ecdd5e083767f442ae342523444feb97fdbd0` |
| 2 | `depositAndActivate` | `0x0f68643d169699597f682bac4103a6083876705d47a91d448c5fd8c9871d12f0` |
| 3 | `submitEvidence` (A) | `0x9229a6c947e46da96279e913d17408f9440c78eab4940fff32267ddb5ddbc86b` |
| 4 | `submitEvidence` (B) | `0xb138b2f64c706bc0184f218cce177ece3c818e477c461c2a203155731fcc71a9` |
| 5 | **`submitVerdict`** | **`0xef94cbdc31ea5971f19d5fb85a4b5562335aabe8a32070f8ebe8f666e55e4a95`** |

All 10 transactions confirmed with status `0x1`.

---

## Wiring Verification (Smoke Test — all PASS)

| Check | Result |
|---|---|
| escrow.registry == ArbitrationRegistry | PASS |
| escrow.creVerifier == CREVerifier | PASS |
| registry.authorized[escrow] == true | PASS |
| registry.authorized[verifier] == true | PASS |
| verifier.escrow == DisputeEscrow | PASS |
| verifier.registry == ArbitrationRegistry | PASS |
| verifier.creOperator == 0x9F485B... | PASS |
| verifier.consensusThreshold == 2 | PASS |
