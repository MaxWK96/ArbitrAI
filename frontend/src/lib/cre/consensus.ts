/**
 * Frontend copy of the CRE consensus engine — used for the What-If Explorer
 * demo panel. Identical logic to cre-workflow/src/consensus.ts.
 */

export type VerdictOutcome =
  | 'FAVOR_PARTY_A'
  | 'FAVOR_PARTY_B'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NO_CONSENSUS'
  | 'CIRCUIT_BREAKER';

export interface ParsedModelVerdict {
  modelId: string;
  vote: VerdictOutcome;
  confidencePct: number;
  reasoning: string;
  parseSuccess: boolean;
}

export interface ConsensusResult {
  finalOutcome: VerdictOutcome;
  consensusCount: number;
  aggregateConfidenceBps: number;
  voteCounts: Record<VerdictOutcome, number>;
  reasoning: string;
}

const CONSENSUS_THRESHOLD = 2;

export function applyConsensus(votes: ParsedModelVerdict[]): ConsensusResult {
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

  if (voteCounts.CIRCUIT_BREAKER > 0) {
    const failedModels = votes.filter((v) => v.vote === 'CIRCUIT_BREAKER').map((v) => v.modelId).join(', ');
    return {
      finalOutcome: 'CIRCUIT_BREAKER',
      consensusCount: voteCounts.CIRCUIT_BREAKER,
      aggregateConfidenceBps: 0,
      voteCounts,
      reasoning: `Circuit breaker: ${failedModels} failed.`,
    };
  }

  const outcomesToCheck: VerdictOutcome[] = ['FAVOR_PARTY_A', 'FAVOR_PARTY_B', 'INSUFFICIENT_EVIDENCE'];

  for (const outcome of outcomesToCheck) {
    const count = voteCounts[outcome];
    if (count >= CONSENSUS_THRESHOLD) {
      const confidences = confidenceByOutcome[outcome];
      const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
      const avgConfidenceBps = Math.round(avgConfidence * 100);

      const agreeing = votes.filter((v) => v.vote === outcome).map((v) => `${v.modelId}(${v.confidencePct}%)`).join(', ');
      const dissenting = votes.filter((v) => v.vote !== outcome).map((v) => `${v.modelId}→${v.vote}`).join(', ');

      return {
        finalOutcome: outcome,
        consensusCount: count,
        aggregateConfidenceBps: avgConfidenceBps,
        voteCounts,
        reasoning: `${count}/3 models voted ${outcome}. Agreeing: ${agreeing}${dissenting ? `. Dissenting: ${dissenting}` : ''}.`,
      };
    }
  }

  const voteBreakdown = votes.map((v) => `${v.modelId}→${v.vote}`).join(', ');
  return {
    finalOutcome: 'NO_CONSENSUS',
    consensusCount: 1,
    aggregateConfidenceBps: 0,
    voteCounts,
    reasoning: `No consensus: ${voteBreakdown}. Funds returned.`,
  };
}

export function simulateWhatIf(
  votes: ParsedModelVerdict[],
  modelIndex: number,
  hypotheticalVote: VerdictOutcome
): ConsensusResult {
  const modified = [...votes];
  modified[modelIndex] = { ...modified[modelIndex], vote: hypotheticalVote };
  return applyConsensus(modified);
}
