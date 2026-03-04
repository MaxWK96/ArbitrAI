# ArbitrAI — Decentralized AI Dispute Resolution

> Chainlink Convergence Hackathon 2026

Trustless freelance dispute resolution. Two parties lock ETH in escrow, submit private evidence via Chainlink Confidential HTTP, and three AI models (Claude, GPT-4o, Mistral) independently analyze it. 2/3 consensus releases funds to the winner. No human arbitrator. No admin key. No way to skip CRE.

---

## The problem your project addresses

Freelance and B2B disputes have no neutral trustee. Platforms like Upwork are biased toward buyers; legal arbitration costs more than most disputed amounts; human arbitrators are slow (weeks to months) and leave no verifiable record. The result is a power imbalance — the party with more leverage wins by default, not on merit.

Three specific failure modes that existing solutions cannot fix:

1. **Evidence is visible to the arbitrator and platform** — either party can be coerced or the arbitrator bribed
2. **No cryptographic link between reasoning and outcome** — a human can settle without ever reading the evidence
3. **Funds require a trusted third party to release** — escrow services have admin keys; one compromised key loses all funds

---

## How you've addressed the problem

ArbitrAI removes the trusted third party entirely. Funds are locked in a smart contract that can only be unlocked by a cryptographic proof that a verifiable AI process ran and reached consensus.

- **Escrow with no admin key**: `executeVerdict()` and `executeRefund()` are `onlyCREVerifier`. No owner, no multisig, no override. Funds are mathematically locked until CRE acts.
- **Private evidence**: Evidence is stored AES-256-GCM encrypted. The CRE workflow fetches it via Confidential HTTP inside a TEE — content never touches a public log. Only the `keccak256` hash is on-chain.
- **Three independent AI votes**: Claude Opus 4.6, GPT-4o, and Mistral Large each analyze the same evidence independently. 2/3 consensus is required; a split triggers a full refund with no fee.
- **Immutable audit trail**: Every model vote, confidence score, evidence hash, and `workflowOutputHash` is recorded permanently in `ArbitrationRegistry`. Anyone can verify the link between the AI reasoning and the on-chain settlement.

---

## How you've used CRE

CRE is not an integration — it is the **only execution path** that can settle a dispute. The `CREVerifier` contract accepts exactly one input: a `WorkflowVerdict` struct with a valid ECDSA signature from the CRE operator key. That key never leaves the CRE HSM.

The workflow (`cre-workflow/workflow.yaml` + `src/index.ts`) runs inside the Chainlink DON and:

1. **Polls** `ArbitrationRegistry` for disputes in `IN_ARBITRATION` state (cron trigger, every 5 min)
2. **Fetches evidence** via `http-confidential@1.0.0` — the TEE capability that keeps request/response out of execution logs
3. **Queries** Claude, GPT-4o, and Mistral in parallel using `http@1.0.0`; verifies `keccak256(content)` matches the hash committed on-chain before sending to any model
4. **Applies 2/3 consensus** — `CIRCUIT_BREAKER` on any API failure, `NO_CONSENSUS` if models split
5. **Signs** the `WorkflowVerdict` struct with secp256k1 using the operator key (pure-JS, WASM-compatible)
6. **Submits** the signed verdict via `eth-transaction-writer@1.0.0` → `CREVerifier.submitVerdict()`

`CREVerifier` then verifies the ECDSA signature, checks staleness (< 1 hour), enforces replay protection, and verifies the evidence hashes match what was submitted on-chain before releasing escrow funds.

**Why CRE specifically?** The operator key signs inside the TEE. A regular off-chain process could fabricate a verdict by signing with a compromised key. CRE's verifiable execution environment is the only way to cryptographically prove that the AI models actually ran and produced the verdict that unlocked the funds.

---

## Live on Sepolia

| Contract | Address | Etherscan |
|---|---|---|
| DisputeEscrow | `0x4829dB4D2f4161BE292D51e1FDc5fe8B08b0bc16` | [view](https://sepolia.etherscan.io/address/0x4829dB4D2f4161BE292D51e1FDc5fe8B08b0bc16) |
| ArbitrationRegistry | `0x2c4aa262a89C3559A4764e52E2f50b9cDacE395F` | [view](https://sepolia.etherscan.io/address/0x2c4aa262a89C3559A4764e52E2f50b9cDacE395F) |
| CREVerifier | `0xAa99Aa0F7C2C5A010f685002AD5F166271ac3a3b` | [view](https://sepolia.etherscan.io/address/0xAa99Aa0F7C2C5A010f685002AD5F166271ac3a3b) |

Both E2E scenarios verified on Sepolia (2026-03-02) — `submitVerdict` Scenario A: [`0x6afb5848...`](https://sepolia.etherscan.io/tx/0x6afb5848100fb7ae4f0e9e390715eda1b399a941237f2b7afeb9e7c570982af2), Scenario B: [`0xef94cbdc...`](https://sepolia.etherscan.io/tx/0xef94cbdc31ea5971f19d5fb85a4b5562335aabe8a32070f8ebe8f666e55e4a95) — full tx table in `deployment-addresses.md`.

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
cp .env.example .env   # fill in API keys + contract addresses
# Simulate against the live Sepolia Scenario A dispute (already settled — read-only demo):
DISPUTE_ID=0x2c4c798cbe05c34f71e541789a06e2fa1e8dac39c36636b1c47ebf3af6df1765 npm run simulate
# To broadcast a verdict on-chain, also set SUBMIT_ONCHAIN=true in .env
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Run `bash setup-env.sh` after deployment to configure all `.env` files automatically.

---

## Running the Full Demo

A single command starts the evidence server, seeds the demo dispute with real evidence, and runs all 6 CRE workflow steps end-to-end — showing real AI verdicts from Claude, GPT-4o, and Mistral.

### Prerequisites

- Node.js 20+
- Real API keys for Anthropic, OpenAI, and Mistral (free tiers work)
- `npm install` run in both `cre-workflow/` and `evidence-server/`

### Setup (one-time)

```bash
# Install dependencies
cd cre-workflow && npm install && cd ..
cd evidence-server && npm install && cd ..

# Configure environment
cp cre-workflow/.env.example cre-workflow/.env
# Then open cre-workflow/.env and fill in:
#   ANTHROPIC_API_KEY=sk-ant-...
#   OPENAI_API_KEY=sk-...
#   MISTRAL_API_KEY=...
# (all other values are pre-filled with the live Sepolia deployment)
```

### Run

```bash
npm run simulate:demo
```

This single command:
1. Validates that real API keys are present (exits with a clear error if placeholders remain)
2. Starts the evidence server on port 3002
3. Seeds demo evidence for both parties in the live Sepolia dispute (`0x0442170...`)
4. Runs the full 6-step CRE workflow against the Sepolia contracts
5. Shows each model's verdict, confidence score, consensus result, and the signed `WorkflowVerdict`
6. Shuts down the evidence server on exit

Expected output (with real keys):

```
[demo] API keys found for: Anthropic, OpenAI, Mistral
[demo] Dispute: 0x0442170ea59ff899df64464d8e0be7601eaa53ada5bd924c90a221f544284ec0
[demo] Starting evidence server...
[demo] Evidence server ready

[demo] Seeding demo evidence...
  [demo] Party A stored — hash: 0x7b9e3a1f2c...
  [demo] Party B stored — hash: 0x4f2d8a0e1b...
[demo] Evidence seeded — hashes match on-chain commitments

Step 1: Fetching dispute from chain...       ✓ IN_ARBITRATION
Step 2: Fetching evidence via Confidential HTTP...  ✓ both parties
Step 3: Querying AI models in parallel...
  Claude Opus 4.6   → PARTY_A  (8500 bps)
  GPT-4o            → PARTY_A  (9100 bps)
  Mistral Large     → PARTY_A  (7800 bps)
Step 4: Applying 2/3 consensus...            ✓ PARTY_A wins
Step 5: Signing WorkflowVerdict...           ✓ signed
Step 6: Verdict ready (SUBMIT_ONCHAIN=false, skipping broadcast)
```

To submit the verdict on-chain: set `SUBMIT_ONCHAIN=true` in `cre-workflow/.env`, then run `npm run simulate:demo`.

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

---

## Chainlink Integration Files

Every file in this repository that directly uses a Chainlink service.

### CRE — Workflow Execution

- [`cre-workflow/workflow.yaml`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/workflow.yaml) — CRE workflow manifest: declares `http-confidential@1.0.0`, `http@1.0.0`, and `eth-transaction-writer@1.0.0` capabilities; defines cron + manual triggers and the 3-step pipeline
- [`cre-workflow/src/index.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/src/index.ts) — CRE WASM entry point: orchestrates the full arbitration pipeline (read dispute → fetch evidence → query AI models → consensus → sign verdict → submit on-chain)
- [`cre-workflow/src/evidence.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/src/evidence.ts) — CRE Confidential HTTP: fetches encrypted dispute evidence inside the TEE; verifies `keccak256(content)` matches the hash committed on-chain
- [`cre-workflow/src/models.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/src/models.ts) — CRE HTTP capability: calls Claude Opus 4.6, GPT-4o, and Mistral Large in parallel using base64-encoded POST bodies; parses structured verdict responses
- [`cre-workflow/src/consensus.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/src/consensus.ts) — CRE: implements 2/3 threshold consensus logic across the three AI model votes; emits `NO_CONSENSUS` or `CIRCUIT_BREAKER` when threshold is not met
- [`cre-workflow/src/signer.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/src/signer.ts) — CRE: ECDSA-signs the `WorkflowVerdict` struct with the CRE operator key using pure-JS secp256k1 (WASM-compatible, no Node.js crypto)
- [`cre-workflow/src/chain.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/cre-workflow/src/chain.ts) — CRE Ethereum Transaction Writer: ABI-encodes `submitVerdict()` calldata and broadcasts the on-chain settlement transaction via JSON-RPC

### CRE — Smart Contract Trust Bridge

- [`contracts/src/CREVerifier.sol`](https://github.com/MaxWK96/ArbitrAI/blob/main/contracts/src/CREVerifier.sol) — CRE verdict execution: verifies the CRE operator ECDSA signature, enforces staleness (< 1 hour), replay protection, and evidence hash integrity before triggering escrow settlement
- [`contracts/src/DisputeEscrow.sol`](https://github.com/MaxWK96/ArbitrAI/blob/main/contracts/src/DisputeEscrow.sol) — CRE-gated fund release: `executeVerdict()` and `executeRefund()` are `onlyCREVerifier` — no admin key can release funds without a valid CRE signature
- [`contracts/src/ArbitrationRegistry.sol`](https://github.com/MaxWK96/ArbitrAI/blob/main/contracts/src/ArbitrationRegistry.sol) — CRE audit trail: records evidence hashes, per-model votes with confidence scores, and the `workflowOutputHash` permanently on-chain
- [`contracts/src/interfaces/IArbitrationRegistry.sol`](https://github.com/MaxWK96/ArbitrAI/blob/main/contracts/src/interfaces/IArbitrationRegistry.sol) — interface consumed by CREVerifier to write state transitions
- [`contracts/src/interfaces/IDisputeEscrow.sol`](https://github.com/MaxWK96/ArbitrAI/blob/main/contracts/src/interfaces/IDisputeEscrow.sol) — interface consumed by CREVerifier to trigger fund settlement
- [`contracts/script/Deploy.s.sol`](https://github.com/MaxWK96/ArbitrAI/blob/main/contracts/script/Deploy.s.sol) — Foundry deploy script: deploys DisputeEscrow, ArbitrationRegistry, and CREVerifier atomically and wires them together

### CRE — Confidential HTTP Target (Evidence Server)

- [`evidence-server/src/server.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/evidence-server/src/server.ts) — the private evidence store that CRE fetches via Confidential HTTP inside the TEE; stores evidence AES-256-GCM encrypted at rest; never accessible to any party other than CRE

### CRE — Frontend Integration

- [`frontend/src/lib/contracts.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/frontend/src/lib/contracts.ts) — deployed contract addresses and ABIs for CREVerifier, ArbitrationRegistry, and DisputeEscrow; used by all functional pages
- [`frontend/src/pages/DemoPage.tsx`](https://github.com/MaxWK96/ArbitrAI/blob/main/frontend/src/pages/DemoPage.tsx) — interactive CRE workflow demo: simulates the full 7-step lifecycle with animated step reveals and a What-If Explorer showing how changing one model's vote affects consensus outcome
- [`frontend/src/lib/cre/consensus.ts`](https://github.com/MaxWK96/ArbitrAI/blob/main/frontend/src/lib/cre/consensus.ts) — frontend mirror of the CRE consensus engine used by the What-If Explorer to compute hypothetical verdicts client-side
