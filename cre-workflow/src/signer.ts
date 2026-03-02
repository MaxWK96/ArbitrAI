/**
 * ArbitrAI CRE Workflow — Verdict Signer
 *
 * Signs the aggregated verdict with the CRE operator's private key.
 * Uses viem for ABI encoding so the TypeScript hash matches Solidity's
 * _computeVerdictHash() exactly — any divergence causes signature failure.
 *
 * Bug fixes applied:
 *  - computeVerdictHash now uses encodeAbiParameters (matching abi.encode in Solidity)
 *    instead of the previous hand-rolled encoding that keccak256'd modelId strings
 *    (incompatible with Solidity's string encoding in abi.encode).
 *  - encodeSubmitVerdictCalldata now uses encodeFunctionData instead of the previous
 *    manually-computed offsets (which were explicitly "rough estimates").
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  hashMessage,
  keccak256 as viemKeccak256,
} from 'viem';
import { secp256k1 } from '@noble/curves/secp256k1';
import { hexToBytes } from '@noble/hashes/utils';
import type { WorkflowVerdict } from './types.js';
import { VerdictOutcomeIndex } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// CREVerifier ABI (submitVerdict only — used for calldata encoding)
// Must match CREVerifier.sol exactly or the transaction will revert.
// ─────────────────────────────────────────────────────────────────────────────

const CRE_VERIFIER_ABI = [
  {
    name: 'submitVerdict',
    type: 'function',
    inputs: [
      {
        name: 'verdict',
        type: 'tuple',
        components: [
          { name: 'disputeId',    type: 'bytes32' },
          { name: 'finalOutcome', type: 'uint8'   },
          {
            name: 'modelVotes',
            type: 'tuple[3]',
            components: [
              { name: 'modelId',       type: 'string'  },
              { name: 'vote',          type: 'uint8'   },
              { name: 'confidenceBps', type: 'uint16'  },
              { name: 'reasoningHash', type: 'bytes32' },
            ],
          },
          { name: 'consensusCount', type: 'uint8'   },
          { name: 'evidenceHashA',  type: 'bytes32' },
          { name: 'evidenceHashB',  type: 'bytes32' },
          { name: 'executedAt',     type: 'uint256' },
          { name: 'workflowRunId',  type: 'bytes32' },
        ],
      },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * keccak256 of a reasoning string, returned as a 32-byte hex string.
 * This is what gets stored on-chain as ModelVote.reasoningHash.
 * Must match: keccak256(bytes(reasoningText)) in Solidity.
 */
function computeReasoningHash(reasoning: string): `0x${string}` {
  return viemKeccak256(new TextEncoder().encode(reasoning));
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict Hash Computation
// Must produce the same hash as CREVerifier._computeVerdictHash()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the deterministic hash of a WorkflowVerdict.
 *
 * Replicates Solidity's:
 *   keccak256(abi.encode(
 *     v.disputeId,
 *     v.finalOutcome,
 *     v.modelVotes[0].modelId, v.modelVotes[0].vote, v.modelVotes[0].confidenceBps, v.modelVotes[0].reasoningHash,
 *     v.modelVotes[1].modelId, ...
 *     v.modelVotes[2].modelId, ...
 *     v.consensusCount,
 *     v.evidenceHashA, v.evidenceHashB,
 *     v.executedAt,
 *     v.workflowRunId
 *   ))
 *
 * Previous bug: modelId was encoded as keccak256(modelId string) → bytes32,
 * which does NOT match Solidity's abi.encode of a `string` type (offset pointer
 * + length word + padded UTF-8 bytes). This caused every signature to fail
 * ECDSA.recover() on-chain.
 *
 * Fix: use viem's encodeAbiParameters which is a byte-for-byte match to
 * Solidity's abi.encode for all types including dynamic string.
 */
export function computeVerdictHash(verdict: WorkflowVerdict): `0x${string}` {
  // Compute reasoningHash[i] = keccak256(reasoning text).
  // These are the values that will appear in the calldata as ModelVote.reasoningHash,
  // so they must be used here too (not the empty-string placeholders in the struct).
  const rh = verdict.modelVotes.map((v) => computeReasoningHash(v.reasoning));

  // 19 flat parameters — matching the Solidity abi.encode call order exactly.
  const encoded = encodeAbiParameters(
    [
      { type: 'bytes32' }, // disputeId
      { type: 'uint8'   }, // finalOutcome
      { type: 'string'  }, // modelVotes[0].modelId
      { type: 'uint8'   }, // modelVotes[0].vote
      { type: 'uint16'  }, // modelVotes[0].confidenceBps
      { type: 'bytes32' }, // modelVotes[0].reasoningHash
      { type: 'string'  }, // modelVotes[1].modelId
      { type: 'uint8'   }, // modelVotes[1].vote
      { type: 'uint16'  }, // modelVotes[1].confidenceBps
      { type: 'bytes32' }, // modelVotes[1].reasoningHash
      { type: 'string'  }, // modelVotes[2].modelId
      { type: 'uint8'   }, // modelVotes[2].vote
      { type: 'uint16'  }, // modelVotes[2].confidenceBps
      { type: 'bytes32' }, // modelVotes[2].reasoningHash
      { type: 'uint8'   }, // consensusCount
      { type: 'bytes32' }, // evidenceHashA
      { type: 'bytes32' }, // evidenceHashB
      { type: 'uint256' }, // executedAt
      { type: 'bytes32' }, // workflowRunId
    ],
    [
      verdict.disputeId as `0x${string}`,
      VerdictOutcomeIndex[verdict.finalOutcome],
      verdict.modelVotes[0].modelId,
      VerdictOutcomeIndex[verdict.modelVotes[0].vote],
      verdict.modelVotes[0].confidenceBps,
      rh[0],
      verdict.modelVotes[1].modelId,
      VerdictOutcomeIndex[verdict.modelVotes[1].vote],
      verdict.modelVotes[1].confidenceBps,
      rh[1],
      verdict.modelVotes[2].modelId,
      VerdictOutcomeIndex[verdict.modelVotes[2].vote],
      verdict.modelVotes[2].confidenceBps,
      rh[2],
      verdict.consensusCount,
      verdict.evidenceHashA as `0x${string}`,
      verdict.evidenceHashB as `0x${string}`,
      BigInt(verdict.executedAt),
      verdict.workflowRunId as `0x${string}`,
    ]
  );

  return viemKeccak256(encoded);
}

// ─────────────────────────────────────────────────────────────────────────────
// ECDSA Signing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Produce an Ethereum-compatible ECDSA signature over the verdict hash.
 * Equivalent to ethers.js Wallet.signMessage(bytes32Hash) — produces the same bytes.
 *
 * Matches Solidity: verdictHash.toEthSignedMessageHash().recover(signature)
 */
export function signVerdict(verdict: WorkflowVerdict, operatorPrivKeyHex: string): string {
  const verdictHash = computeVerdictHash(verdict);

  // Apply "\x19Ethereum Signed Message:\n32" prefix — matches MessageHashUtils.toEthSignedMessageHash
  const ethHash = hashMessage({ raw: verdictHash });
  const ethHashBytes = hexToBytes(ethHash.slice(2));

  const privKeyBytes = hexToBytes(operatorPrivKeyHex.replace('0x', ''));
  const sig = secp256k1.sign(ethHashBytes, privKeyBytes);

  // Encode as [r(32) || s(32) || v(1)] — matches Solidity's ECDSA.recover
  const r = sig.r.toString(16).padStart(64, '0');
  const s = sig.s.toString(16).padStart(64, '0');
  const v = (sig.recovery! + 27).toString(16).padStart(2, '0');

  return '0x' + r + s + v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Calldata Encoding
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the complete calldata for CREVerifier.submitVerdict(verdict, signature).
 *
 * Previous bug: used hand-computed offsets with an acknowledged "rough estimate"
 * comment. The offset for the signature argument was wrong, making the tx revert.
 *
 * Fix: viem's encodeFunctionData handles all ABI encoding including dynamic
 * types (strings, bytes, fixed-size tuple arrays) with correct head/tail layout.
 */
export function encodeSubmitVerdictCalldata(
  verdict: WorkflowVerdict,
  signature: string
): string {
  const rh = verdict.modelVotes.map((v) => computeReasoningHash(v.reasoning));

  return encodeFunctionData({
    abi: CRE_VERIFIER_ABI,
    functionName: 'submitVerdict',
    args: [
      {
        disputeId:    verdict.disputeId    as `0x${string}`,
        finalOutcome: VerdictOutcomeIndex[verdict.finalOutcome],
        modelVotes: [
          {
            modelId:       verdict.modelVotes[0].modelId,
            vote:          VerdictOutcomeIndex[verdict.modelVotes[0].vote],
            confidenceBps: verdict.modelVotes[0].confidenceBps,
            reasoningHash: rh[0],
          },
          {
            modelId:       verdict.modelVotes[1].modelId,
            vote:          VerdictOutcomeIndex[verdict.modelVotes[1].vote],
            confidenceBps: verdict.modelVotes[1].confidenceBps,
            reasoningHash: rh[1],
          },
          {
            modelId:       verdict.modelVotes[2].modelId,
            vote:          VerdictOutcomeIndex[verdict.modelVotes[2].vote],
            confidenceBps: verdict.modelVotes[2].confidenceBps,
            reasoningHash: rh[2],
          },
        ],
        consensusCount: verdict.consensusCount,
        evidenceHashA:  verdict.evidenceHashA  as `0x${string}`,
        evidenceHashB:  verdict.evidenceHashB  as `0x${string}`,
        executedAt:     BigInt(verdict.executedAt),
        workflowRunId:  verdict.workflowRunId  as `0x${string}`,
      },
      signature as `0x${string}`,
    ],
  });
}
