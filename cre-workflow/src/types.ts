// ─────────────────────────────────────────────────────────────────────────────
// ArbitrAI CRE Workflow — Shared Types
// These types mirror the Solidity structs in CREVerifier.sol exactly.
// Any mismatch will cause ABI encoding failures when submitting on-chain.
// ─────────────────────────────────────────────────────────────────────────────

/** Maps to CREVerifier.VerdictOutcome enum (uint8) */
export type VerdictOutcome =
  | 'FAVOR_PARTY_A'         // 0 — AI consensus: party A wins
  | 'FAVOR_PARTY_B'         // 1 — AI consensus: party B wins
  | 'INSUFFICIENT_EVIDENCE' // 2 — Models agree: not enough to decide
  | 'NO_CONSENSUS'          // 3 — Models disagree
  | 'CIRCUIT_BREAKER';      // 4 — Model failure or timeout

/** Numeric encoding for on-chain submission (must match Solidity enum order) */
export const VerdictOutcomeIndex: Record<VerdictOutcome, number> = {
  FAVOR_PARTY_A: 0,
  FAVOR_PARTY_B: 1,
  INSUFFICIENT_EVIDENCE: 2,
  NO_CONSENSUS: 3,
  CIRCUIT_BREAKER: 4,
};

/** Maps to CREVerifier.ModelVote struct */
export interface ModelVote {
  modelId: string;       // e.g. "claude-opus-4-6", "gpt-4o", "mistral-large-2411"
  vote: VerdictOutcome;
  confidenceBps: number; // 0-10000 (basis points), e.g. 8750 = 87.5%
  reasoning: string;     // Full reasoning text — stored in CRE logs, NOT on-chain
  reasoningHash: string; // keccak256(reasoning) — stored on-chain for verification
}

/** Maps to CREVerifier.WorkflowVerdict struct */
export interface WorkflowVerdict {
  disputeId: string;     // bytes32 hex string
  finalOutcome: VerdictOutcome;
  modelVotes: [ModelVote, ModelVote, ModelVote]; // exactly 3
  consensusCount: number; // 0-3
  evidenceHashA: string; // bytes32 — must match registry
  evidenceHashB: string; // bytes32 — must match registry
  executedAt: number;    // unix timestamp
  workflowRunId: string; // bytes32 — unique CRE run identifier
}

/** Evidence fetched via Confidential HTTP */
export interface Evidence {
  partyAddress: string;
  partyLabel: 'A' | 'B';
  content: string;         // Full evidence text — processed in CRE TEE only
  submittedAt: number;
  contentHash: string;     // keccak256(content) — must match on-chain evidenceHash
}

/** Dispute data fetched from ArbitrationRegistry */
export interface DisputeRecord {
  id: string;
  partyA: string;
  partyB: string;
  description: string;
  amount: string;          // in wei (string to avoid BigInt issues)
  status: string;
  evidenceHashA: string;   // bytes32 hex
  evidenceHashB: string;   // bytes32 hex
  createdAt: number;
}

/** Prompt sent identically to all 3 AI models */
export interface ArbitrationPrompt {
  disputeId: string;
  description: string;
  partyAAddress: string;
  partyBAddress: string;
  evidenceA: string;       // Evidence content for party A
  evidenceB: string;       // Evidence content for party B
}

/** Raw AI model response before parsing */
export interface RawModelResponse {
  modelId: string;
  rawText: string;
  durationMs: number;
  error?: string;          // Set if the model call failed
}

/** Parsed AI verdict (after extracting from raw text) */
export interface ParsedModelVerdict {
  modelId: string;
  vote: VerdictOutcome;
  confidencePct: number;   // 0-100 (we convert to BPS when building WorkflowVerdict)
  reasoning: string;
  parseSuccess: boolean;
}

/** CRE secrets injected at runtime */
export interface CRESecrets {
  anthropicKey: string;
  openaiKey: string;
  mistralKey: string;
  operatorPrivKey: string; // Hex private key — only used for signing, never logged
  evidenceKey: string;
  rpcUrl: string;
}

/** CRE environment variables */
export interface CREEnv {
  registryContract: string;
  verifierContract: string;
  evidenceServerUrl: string;
  chainId: string;
}

/** Final workflow output — used by CRE to write on-chain */
export interface WorkflowOutput {
  disputeId: string;
  calldata: string;      // ABI-encoded CREVerifier.submitVerdict(verdict, signature)
  verdictSummary: string; // Human-readable for logs
  signature: string;     // The ECDSA signature (included in calldata, also logged separately)
}
