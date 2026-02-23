/**
 * ArbitrAI CRE Workflow — 2/3 Consensus Engine
 *
 * This module implements the consensus logic that determines the final verdict
 * from three AI model votes. This is the "AI Agents" prize track component:
 * multiple models acting as independent agents, with threshold-based aggregation.
 *
 * Rules:
 *  - If ANY model returns CIRCUIT_BREAKER (failure), immediately halt
 *  - If ≥2 models agree on an outcome, that outcome wins
 *  - If all 3 models disagree (each votes differently), NO_CONSENSUS → refund
 *  - Confidence scores are averaged for the winning side
 *
 * Branching:
 *  FAVOR_PARTY_A (2-3 votes) → Alice wins, funds released to Alice
 *  FAVOR_PARTY_B (2-3 votes) → Bob wins, funds released to Bob
 *  INSUFFICIENT_EVIDENCE (2-3 votes) → Refund (agreed: not enough to decide)
 *  NO_CONSENSUS → Refund (models disagree)
 *  CIRCUIT_BREAKER (any) → Emergency refund
 */

import type { ParsedModelVerdict, VerdictOutcome } from './types.js';

export interface ConsensusResult {
  finalOutcome: VerdictOutcome;
  consensusCount: number;
  // Aggregated confidence for the winning outcome (0-10000 BPS)
  aggregateConfidenceBps: number;
  // Per-outcome vote counts for transparency
  voteCounts: Record<VerdictOutcome, number>;
  reasoning: string;
}

const CONSENSUS_THRESHOLD = 2; // 2 out of 3

/**
 * Apply 2/3 consensus to three parsed AI verdicts.
 * This runs inside the CRE execution environment after all models respond.
 */
export function applyConsensus(votes: ParsedModelVerdict[]): ConsensusResult {
  if (votes.length !== 3) {
    throw new Error(`Expected exactly 3 votes, got ${votes.length}`);
  }

  // ── Count votes per outcome ─────────────────────────────────────────────

  const voteCounts: Record<VerdictOutcome, number> = {
    FAVOR_PARTY_A: 0,
    FAVOR_PARTY_B: 0,
    INSUFFICIENT_EVIDENCE: 0,
    NO_CONSENSUS: 0,
    CIRCUIT_BREAKER: 0,
  };

  const confidenceByOutcome: Record<VerdictOutcome, number[]> = {
    FAVOR_PARTY_A: [],
    FAVOR_PARTY_B: [],
    INSUFFICIENT_EVIDENCE: [],
    NO_CONSENSUS: [],
    CIRCUIT_BREAKER: [],
  };

  for (const v of votes) {
    voteCounts[v.vote]++;
    confidenceByOutcome[v.vote].push(v.confidencePct);
  }

  // ── Rule 1: Circuit breaker — any model failure halts everything ─────────
  // Even if 2 models succeed, a single failure is a trust signal we can't ignore.
  if (voteCounts.CIRCUIT_BREAKER > 0) {
    const failedModels = votes
      .filter((v) => v.vote === 'CIRCUIT_BREAKER')
      .map((v) => v.modelId)
      .join(', ');

    return {
      finalOutcome: 'CIRCUIT_BREAKER',
      consensusCount: voteCounts.CIRCUIT_BREAKER,
      aggregateConfidenceBps: 0,
      voteCounts,
      reasoning: `Circuit breaker: ${failedModels} failed to return a valid verdict. Funds refunded for safety.`,
    };
  }

  // ── Rule 2: Check each deterministic outcome for 2/3 threshold ──────────
  const outcomesToCheck: VerdictOutcome[] = [
    'FAVOR_PARTY_A',
    'FAVOR_PARTY_B',
    'INSUFFICIENT_EVIDENCE',
  ];

  for (const outcome of outcomesToCheck) {
    const count = voteCounts[outcome];
    if (count >= CONSENSUS_THRESHOLD) {
      const confidences = confidenceByOutcome[outcome];
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const avgConfidenceBps = Math.round(avgConfidence * 100); // pct → BPS

      const agreeing = votes
        .filter((v) => v.vote === outcome)
        .map((v) => `${v.modelId} (${v.confidencePct}%)`)
        .join(', ');

      const dissenting = votes
        .filter((v) => v.vote !== outcome)
        .map((v) => `${v.modelId}→${v.vote} (${v.confidencePct}%)`)
        .join(', ');

      return {
        finalOutcome: outcome,
        consensusCount: count,
        aggregateConfidenceBps: avgConfidenceBps,
        voteCounts,
        reasoning: [
          `Consensus: ${count}/3 models voted ${outcome}`,
          `Agreeing: ${agreeing}`,
          dissenting ? `Dissenting: ${dissenting}` : 'Unanimous',
          `Aggregate confidence: ${(avgConfidenceBps / 100).toFixed(1)}%`,
        ].join(' | '),
      };
    }
  }

  // ── Rule 3: No consensus — all models disagree ───────────────────────────
  const voteBreakdown = votes.map((v) => `${v.modelId}→${v.vote}`).join(', ');

  return {
    finalOutcome: 'NO_CONSENSUS',
    consensusCount: 1, // Best any single model achieved
    aggregateConfidenceBps: 0,
    voteCounts,
    reasoning: `No consensus: ${voteBreakdown}. Threshold: ${CONSENSUS_THRESHOLD}/3. Funds returned to both parties.`,
  };
}

/**
 * Simulate "what if" — used by the frontend demo panel.
 * Shows what would happen if one model voted differently.
 */
export function simulateWhatIf(
  votes: ParsedModelVerdict[],
  modelIndex: number,
  hypotheticalVote: VerdictOutcome
): ConsensusResult {
  const modified = [...votes];
  modified[modelIndex] = { ...modified[modelIndex], vote: hypotheticalVote };
  return applyConsensus(modified as ParsedModelVerdict[]);
}
