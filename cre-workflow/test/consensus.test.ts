/**
 * Consensus engine tests — the most critical logic in the workflow
 */
import { describe, it, expect } from 'vitest';
import { applyConsensus, simulateWhatIf } from '../src/consensus.js';
import type { ParsedModelVerdict } from '../src/types.js';

function makeVote(modelId: string, vote: ParsedModelVerdict['vote'], confidence = 80): ParsedModelVerdict {
  return { modelId, vote, confidencePct: confidence, reasoning: `${modelId} says ${vote}`, parseSuccess: true };
}

describe('applyConsensus', () => {
  it('3/3 unanimous — party A wins', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A', 90),
      makeVote('gpt4', 'FAVOR_PARTY_A', 85),
      makeVote('mistral', 'FAVOR_PARTY_A', 75),
    ];
    const result = applyConsensus(votes);
    expect(result.finalOutcome).toBe('FAVOR_PARTY_A');
    expect(result.consensusCount).toBe(3);
    expect(result.aggregateConfidenceBps).toBe(8333); // avg of 90,85,75 = 83.33%
  });

  it('2/3 consensus — party B wins', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_B', 80),
      makeVote('gpt4', 'FAVOR_PARTY_B', 70),
      makeVote('mistral', 'FAVOR_PARTY_A', 65),
    ];
    const result = applyConsensus(votes);
    expect(result.finalOutcome).toBe('FAVOR_PARTY_B');
    expect(result.consensusCount).toBe(2);
  });

  it('2/3 consensus — insufficient evidence', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'INSUFFICIENT_EVIDENCE', 60),
      makeVote('gpt4', 'INSUFFICIENT_EVIDENCE', 55),
      makeVote('mistral', 'FAVOR_PARTY_A', 70),
    ];
    const result = applyConsensus(votes);
    expect(result.finalOutcome).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.consensusCount).toBe(2);
  });

  it('all 3 models disagree — NO_CONSENSUS → refund', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A'),
      makeVote('gpt4', 'FAVOR_PARTY_B'),
      makeVote('mistral', 'INSUFFICIENT_EVIDENCE'),
    ];
    const result = applyConsensus(votes);
    expect(result.finalOutcome).toBe('NO_CONSENSUS');
    expect(result.consensusCount).toBe(1);
    expect(result.aggregateConfidenceBps).toBe(0);
  });

  it('circuit breaker — ANY model failure halts everything', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A', 90),
      makeVote('gpt4', 'FAVOR_PARTY_A', 85),
      makeVote('mistral', 'CIRCUIT_BREAKER', 0),  // Mistral failed
    ];
    const result = applyConsensus(votes);
    // Even though 2/3 models agree on FAVOR_PARTY_A, circuit breaker wins
    expect(result.finalOutcome).toBe('CIRCUIT_BREAKER');
    expect(result.consensusCount).toBe(1);
  });

  it('2 models fail — circuit breaker', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A', 90),
      makeVote('gpt4', 'CIRCUIT_BREAKER', 0),
      makeVote('mistral', 'CIRCUIT_BREAKER', 0),
    ];
    const result = applyConsensus(votes);
    expect(result.finalOutcome).toBe('CIRCUIT_BREAKER');
    expect(result.consensusCount).toBe(2);
  });

  it('confidence is averaged correctly for 2/3 consensus', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A', 80),
      makeVote('gpt4', 'FAVOR_PARTY_A', 60),
      makeVote('mistral', 'FAVOR_PARTY_B', 90),
    ];
    const result = applyConsensus(votes);
    expect(result.finalOutcome).toBe('FAVOR_PARTY_A');
    expect(result.aggregateConfidenceBps).toBe(7000); // avg of 80, 60 = 70%
  });

  it('reasoning string contains model names', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude-opus-4-6', 'FAVOR_PARTY_A'),
      makeVote('gpt-4o', 'FAVOR_PARTY_A'),
      makeVote('mistral-large', 'FAVOR_PARTY_B'),
    ];
    const result = applyConsensus(votes);
    expect(result.reasoning).toContain('claude-opus-4-6');
    expect(result.reasoning).toContain('gpt-4o');
  });
});

describe('simulateWhatIf', () => {
  it('shows impact of one model changing vote', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A'),
      makeVote('gpt4', 'FAVOR_PARTY_A'),
      makeVote('mistral', 'FAVOR_PARTY_B'),
    ];

    // Current: A wins 2/3
    const current = applyConsensus(votes);
    expect(current.finalOutcome).toBe('FAVOR_PARTY_A');

    // What if Mistral also voted A? → 3/3 unanimous
    const allA = simulateWhatIf(votes, 2, 'FAVOR_PARTY_A');
    expect(allA.finalOutcome).toBe('FAVOR_PARTY_A');
    expect(allA.consensusCount).toBe(3);

    // What if Claude voted B? → 2/3 B wins
    const bWins = simulateWhatIf(votes, 0, 'FAVOR_PARTY_B');
    expect(bWins.finalOutcome).toBe('FAVOR_PARTY_B');
    expect(bWins.consensusCount).toBe(2);

    // What if Claude voted insufficient? → NO_CONSENSUS (each model differs)
    const noConsensus = simulateWhatIf(votes, 0, 'INSUFFICIENT_EVIDENCE');
    expect(noConsensus.finalOutcome).toBe('NO_CONSENSUS');
  });

  it('what-if does not modify original votes', () => {
    const votes: [ParsedModelVerdict, ParsedModelVerdict, ParsedModelVerdict] = [
      makeVote('claude', 'FAVOR_PARTY_A'),
      makeVote('gpt4', 'FAVOR_PARTY_A'),
      makeVote('mistral', 'FAVOR_PARTY_B'),
    ];
    simulateWhatIf(votes, 0, 'CIRCUIT_BREAKER');
    // Original votes unchanged
    expect(votes[0].vote).toBe('FAVOR_PARTY_A');
  });
});
