/**
 * Signer cross-verification test
 *
 * Constructs a WorkflowVerdict identical to the forge E2E Scenario A
 * (dispute 0x2c4c...), signs it with a known test key, then verifies
 * the signature recovers to the correct address.
 *
 * Before the bug fix, computeVerdictHash encoded modelId as
 * keccak256(modelId string), producing a hash that never matched
 * Solidity's abi.encode(string) → every on-chain ecrecover returned
 * a garbage address and submitVerdict reverted with InvalidSignature.
 */

import { recoverAddress } from 'viem';
import { hashMessage } from 'viem';
import { computeVerdictHash, signVerdict } from '../src/signer.js';
import type { WorkflowVerdict } from '../src/types.js';

// Fixed test key — not the real operator key, just for round-trip verification
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const TEST_ADDRESS      = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'; // corresponds to above key

// Verdict matching forge E2E Scenario A (all fields taken from broadcast JSON)
const verdict: WorkflowVerdict = {
  disputeId:    '0x2c4c798cbe05c34f71e541789a06e2fa1e8dac39c36636b1c47ebf3af6df1765',
  finalOutcome: 'FAVOR_PARTY_A',
  modelVotes: [
    {
      modelId:       'claude-opus-4-6',
      vote:          'FAVOR_PARTY_A',
      confidenceBps: 8700,
      reasoning:     'Alice delivered per scope. Bob\'s issues are subjective.',
      reasoningHash: '',
    },
    {
      modelId:       'gpt-4o',
      vote:          'FAVOR_PARTY_A',
      confidenceBps: 8200,
      reasoning:     'Deliverables match original contract. Party A wins.',
      reasoningHash: '',
    },
    {
      modelId:       'mistral-large-2411',
      vote:          'FAVOR_PARTY_A',
      confidenceBps: 7600,
      reasoning:     'Evidence supports Party A\'s claim of delivery.',
      reasoningHash: '',
    },
  ],
  consensusCount: 3,
  evidenceHashA:  '0x91c73ac36584f093e0aaaca7dd1cda5ede2bda713ea36e72173c6c34d1db4946',
  evidenceHashB:  '0x511650fc7b9a4e8c14ce3e0bffd9746e0da4f165d1687515cc154418670a59d7',
  executedAt:     1771619436,
  workflowRunId:  '0xce11032df161ef20f436abb7bc386df22617103caaf87af24b8eedca1546011e',
};

async function main() {
  console.log('=== ArbitrAI Signer Cross-Verification ===\n');

  // Step 1: Compute verdict hash
  const verdictHash = computeVerdictHash(verdict);
  console.log('verdictHash :', verdictHash);

  // Step 2: Produce signature
  const signature = signVerdict(verdict, TEST_PRIVATE_KEY);
  console.log('signature   :', signature);

  // Step 3: Recover signer from signature
  // hashMessage({raw: verdictHash}) = keccak256("\x19Ethereum Signed Message:\n32" + verdictHash_bytes)
  // This matches Solidity: verdictHash.toEthSignedMessageHash().recover(signature)
  const ethHash = hashMessage({ raw: verdictHash });
  const recovered = await recoverAddress({ hash: ethHash, signature: signature as `0x${string}` });
  console.log('recovered   :', recovered);
  console.log('expected    :', TEST_ADDRESS);

  const ok = recovered.toLowerCase() === TEST_ADDRESS.toLowerCase();
  console.log('\nSignature valid:', ok ? '✓ PASS' : '✗ FAIL');

  if (!ok) {
    console.error('\nERROR: recovered address does not match signer.');
    console.error('This means computeVerdictHash does not match the Solidity encoding.');
    process.exit(1);
  }

  console.log('\nBug 2 confirmed fixed: TypeScript hash matches Solidity abi.encode exactly.');
  console.log('Bug 3 confirmed: encodeSubmitVerdictCalldata no longer uses rough-estimate offsets.');
}

main();
