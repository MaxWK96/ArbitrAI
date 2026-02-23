# ArbitrAI — Decentralized AI Dispute Resolution

> Chainlink Convergence Hackathon 2026

Trustless freelance dispute resolution. Two parties lock ETH in escrow, submit private evidence via Chainlink Confidential HTTP, and three AI models (Claude, GPT-4o, Mistral) independently analyze it. 2/3 consensus releases funds to the winner. No human arbitrator. No admin key. No way to skip CRE.

---

## Live on Sepolia

| Contract | Address | Etherscan |
|---|---|---|
| DisputeEscrow | `0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7` | [view](https://sepolia.etherscan.io/address/0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7) |
| ArbitrationRegistry | `0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5` | [view](https://sepolia.etherscan.io/address/0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5) |
| CREVerifier | `0x18b34E31290Ac10dE263943cD9D617EE1f570133` | [view](https://sepolia.etherscan.io/address/0x18b34E31290Ac10dE263943cD9D617EE1f570133) |

Both E2E scenarios verified on Sepolia — see `deployment-addresses.md` for transaction details.

---

## Prize Track Mapping

### Chainlink CRE — Core Integration
CRE is not decorative. It is the **only path** to escrow settlement.

- `CREVerifier.submitVerdict()` can only be called with a valid ECDSA signature from the CRE operator key
- The operator key signs the `WorkflowVerdict` struct inside the CRE WASM workflow — never exposed outside
- If CRE fails to run, funds remain locked — no admin override, no manual fallback
- CRE workflow: `cre-workflow/src/index.ts` — orchestrates 3 AI models, applies consensus, signs verdict, submits on-chain

**Files**: `cre-workflow/` — TypeScript WASM workflow with `workflow.yaml` manifest

---

### Chainlink Confidential HTTP — Privacy
Evidence content is never stored on-chain or logged anywhere accessible.

- `workflow.yaml` declares `http-confidential@1.0.0` capability — evidence fetched inside TEE
- `cre-workflow/src/evidence.ts` uses Confidential HTTP to fetch evidence from the private server
- Evidence integrity enforced: `keccak256(content)` must match `evidenceHashA/B` stored on-chain
- Content never appears in CRE logs — only the hash is public

**Files**: `cre-workflow/src/evidence.ts`, `evidence-server/src/server.ts`, `workflow.yaml`

---

### Risk & Compliance — Circuit Breaker + Audit Trail
Two independent safety mechanisms protect parties if AI reasoning fails.

**Circuit Breaker**:
- If any model returns `CIRCUIT_BREAKER` (API error, malformed response, timeout) — automatic full refund, no fee
- If consensus < 2/3 — `NO_CONSENSUS` verdict, full refund
- `DisputeEscrow.executeRefund()` is the only other settlement path — requires CREVerifier authorization

**Immutable Audit Trail**:
- `ArbitrationRegistry` records every state transition with timestamp
- `evidenceHashA` and `evidenceHashB` stored on-chain — links public hash to private content
- `workflowOutputHash` recorded on-chain — links settlement to exact AI reasoning that produced it
- `ModelVoteRecorded` events: each model's vote, confidence (bps), and `reasoningHash` are on-chain forever

**Files**: `contracts/src/ArbitrationRegistry.sol`, `contracts/src/CREVerifier.sol`

---

### Multi-Model AI Consensus — 3 Independent Arbitrators
No single AI model controls the outcome.

- Claude Opus 4.6, GPT-4o, and Mistral Large run independently — each reads the same evidence, produces its own verdict
- Consensus engine (`cre-workflow/src/consensus.ts`) requires 2/3 agreement on the same outcome
- Each model's `confidenceBps` (0-10000), vote, and `reasoningHash` are committed on-chain
- What-If Explorer in the frontend lets users replay verdicts and see how changing one model's vote affects outcome

**Files**: `cre-workflow/src/models.ts`, `cre-workflow/src/consensus.ts`, `frontend/src/pages/DemoPage.tsx`

---

### Escrow Security — No Admin Keys
`DisputeEscrow` is designed so no admin can unilaterally release funds.

- `executeVerdict()` and `executeRefund()` are `onlyCREVerifier` — no owner override
- `ReentrancyGuard` on all fund movements
- `Pausable` only freezes new dispute creation — cannot freeze or redirect existing funds
- Protocol fee is 1% of total pool, taken transparently from the settlement transaction
- Evidence-hash mismatch reverts the verdict submission — CRE cannot fabricate evidence it didn't see

**Files**: `contracts/src/DisputeEscrow.sol`

---

## Architecture

```
[Party A]  --createDispute()-->  [DisputeEscrow]  --registerDispute()-->  [ArbitrationRegistry]
[Party B]  --depositAndActivate()-->  [DisputeEscrow]
[Party A/B]  --submitEvidence()-->  [ArbitrationRegistry]  (on-chain hash, private content)

                                 [Chainlink CRE Workflow]
                                   |  1. Read dispute from chain
                                   |  2. Fetch evidence via Confidential HTTP (TEE)
                                   |  3. Query Claude + GPT-4o + Mistral in parallel
                                   |  4. Apply 2/3 consensus
                                   |  5. Sign WorkflowVerdict with operator key
                                   |  6. Submit on-chain
                                   v
[CRE Operator]  --submitVerdict(verdict, sig)-->  [CREVerifier]
                                                     |  verify ECDSA sig
                                                     |  check staleness (< 1 hour)
                                                     |  check replay protection
                                                     |  check evidence hash integrity
                                                     v
                                              [DisputeEscrow]
                                                |  executeVerdict()  -->  winner gets 99% of pool
                                                |  executeRefund()   -->  both parties refunded 100%
                                                v
                                         [ArbitrationRegistry]
                                              workflowOutputHash stored permanently
```

---

## Local Setup

### Requirements
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- Node.js 20+
- Sepolia RPC URL (Alchemy/Infura)

### 1. Smart Contracts

```bash
cd contracts
cp .env.example .env   # fill in keys
forge test             # 23 tests, all pass
forge script script/Deploy.s.sol --broadcast --verify --rpc-url $SEPOLIA_RPC_URL
```

### 2. Evidence Server

```bash
cd evidence-server
npm install
npm start              # runs on port 3002
```

### 3. CRE Workflow

```bash
cd cre-workflow
npm install
DISPUTE_ID=0x... npm run simulate
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Run `bash setup-env.sh` after deployment to configure all `.env` files automatically.

---

## Test Results

```
Ran 23 tests for test/ArbitrAI.t.sol:ArbitrAITest
Suite result: ok. 23 passed; 0 failed; 0 skipped
```

Covers: happy path (Alice wins, Bob wins), failure modes (no consensus, circuit breaker, emergency refund),
security tests (invalid sig, replay, double-settle, stale verdict, evidence mismatch, access control),
fee math, fuzz test (256 runs).

---

## Repository Structure

```
ArbitrAI/
├── contracts/              Foundry - 3 Solidity contracts, deploy/smoke/E2E scripts
│   ├── src/
│   │   ├── DisputeEscrow.sol
│   │   ├── ArbitrationRegistry.sol
│   │   └── CREVerifier.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   ├── Smoke.s.sol
│   │   └── E2ETest.s.sol
│   └── test/ArbitrAI.t.sol
├── cre-workflow/           Chainlink CRE TypeScript WASM workflow
│   ├── workflow.yaml
│   └── src/
│       ├── index.ts        Main orchestrator
│       ├── evidence.ts     Confidential HTTP evidence fetcher
│       ├── models.ts       Claude + GPT-4o + Mistral callers
│       ├── consensus.ts    2/3 consensus engine
│       ├── signer.ts       ECDSA signing
│       └── chain.ts        On-chain submission
├── evidence-server/        Private evidence storage (AES-256-GCM at rest)
├── frontend/               React + Vite + TailwindCSS
│   └── src/pages/
│       ├── HomePage.tsx
│       ├── CreateDisputePage.tsx
│       ├── DisputePage.tsx
│       └── DemoPage.tsx    Interactive CRE demo + What-If Explorer
├── deployment-addresses.md All contract addresses + E2E tx hashes
└── setup-env.sh            Auto-configure all .env files post-deploy
```
