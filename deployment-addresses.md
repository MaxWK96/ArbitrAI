# ArbitrAI — Deployed Contract Addresses (Sepolia)

> Network: Ethereum Sepolia Testnet (chainId: 11155111)
> Deployed: 2026-02-20
> Deployer: `0xd27673C4F38680C0968086Bb833eb876eeB65546`
> CRE Operator: `0xd27673C4F38680C0968086Bb833eb876eeB65546`
> Treasury: `0xd27673C4F38680C0968086Bb833eb876eeB65546`

---

## Contracts

### DisputeEscrow
Holds ETH during arbitration. Funds can ONLY be released via a verified CRE workflow verdict.

- **Address**: `0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7`
- **Etherscan**: https://sepolia.etherscan.io/address/0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7
- **MIN_DEPOSIT**: 0.005 ETH
- **PROTOCOL_FEE_BPS**: 100 (1%)

### ArbitrationRegistry
Immutable on-chain audit trail. Records every state transition, evidence hash, and workflow output.

- **Address**: `0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5`
- **Etherscan**: https://sepolia.etherscan.io/address/0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5

### CREVerifier
Trust bridge between Chainlink CRE and escrow settlement. Verifies ECDSA operator signature and enforces 2/3 model consensus.

- **Address**: `0x18b34E31290Ac10dE263943cD9D617EE1f570133`
- **Etherscan**: https://sepolia.etherscan.io/address/0x18b34E31290Ac10dE263943cD9D617EE1f570133
- **Consensus Threshold**: 2/3 models
- **Max Verdict Age**: 1 hour (staleness protection)

---

## E2E Test Transactions (Sepolia)

### Scenario A — Happy Path (Alice wins, 3/3 consensus)
- **Dispute ID**: `0x2c4c798cbe05c34f71e541789a06e2fa1e8dac39c36636b1c47ebf3af6df1765`
- Party A (Alice): `0xaC266469bB463Ec83E2D6845e513d47B191739B0`
- Party B (Bob): `0xEe6cadE823BB01321Fa753FC0E89bd9402A04Dd7`
- Outcome: FAVOR_PARTY_A — Alice received 0.0198 ETH (0.02 pool - 1% fee)
- Protocol fee: 0.0002 ETH to treasury
- Escrow cleared: 0 balance after settlement

### Scenario B — Failure Mode (no consensus, full refund)
- **Dispute ID**: `0xf389a96562894d7a3b0b965eb4741f78cb3c4210bb751f23b3976dc6e2eec057`
- Outcome: NO_CONSENSUS — circuit breaker activated, both parties refunded 0.01 ETH each
- No fee taken on refunds
- Escrow cleared: 0 balance after refund

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
| verifier.creOperator == 0xd276... | PASS |
| verifier.consensusThreshold == 2 | PASS |
