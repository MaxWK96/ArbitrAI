/**
 * ArbitrAI CRE Workflow — Main Orchestrator
 *
 * This is the entry point that runs inside the Chainlink CRE execution environment.
 * It orchestrates the complete arbitration pipeline:
 *
 *   [Trigger] → [Fetch Dispute] → [Fetch Evidence] → [Query 3 AI Models]
 *            → [2/3 Consensus] → [Sign Verdict] → [Submit On-Chain]
 *
 * This file is compiled to WASM by Javy and executed by the CRE runtime.
 * The __main() function is the WASM entry point.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CRE Integration Notes:
 *
 * In CRE WASM execution:
 *  - Input comes from workflow.yaml step inputs (injected as global __INPUT)
 *  - Output is written to global __OUTPUT (consumed by CRE Eth Transaction Writer)
 *  - HTTP calls use the CRE SDK http capability (confidential or standard)
 *  - Secrets are injected at runtime and never logged
 *  - The binary has no file system access, no network access outside capabilities
 *
 * In local simulation (tsx src/index.ts):
 *  - Input is read from STDIN or env vars
 *  - HTTP calls use native fetch()
 *  - Output is printed to STDOUT
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  CREEnv,
  CRESecrets,
  WorkflowVerdict,
  WorkflowOutput,
  DisputeRecord,
  ArbitrationPrompt,
} from './types.js';
import type { HttpFetchFn, HttpRequest, HttpResponse } from './models.js';
import { fetchBothEvidences, fetchDisputeFromChain } from './evidence.js';
import { queryAllModels } from './models.js';
import { applyConsensus } from './consensus.js';
import { signVerdict } from './signer.js';
import { buildWorkflowOutput, submitVerdictOnChain } from './chain.js';
import { bytesToHex } from '@noble/hashes/utils';
import { keccak_256 } from '@noble/hashes/sha3';

// ─────────────────────────────────────────────────────────────────────────────
// CRE HTTP Adapter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In CRE WASM: sdk.http.fetch() is injected by the CRE runtime.
 * In local simulation: we use native fetch() with an adapter.
 */
function buildHttpFetch(isConfidential = false): HttpFetchFn {
  // Check if running in CRE WASM environment
  // @ts-ignore — CRE SDK global injected at runtime
  if (typeof __cre_sdk !== 'undefined') {
    // @ts-ignore
    const capability = isConfidential ? __cre_sdk.http.confidential : __cre_sdk.http;
    return capability.fetch.bind(capability);
  }

  // Local simulation: use native fetch
  return async (req: HttpRequest): Promise<HttpResponse> => {
    const headers: Record<string, string> = req.headers ?? {};

    const body = req.body
      ? Buffer.from(req.body, 'base64').toString('utf-8')
      : undefined;

    const response = await fetch(req.url, {
      method: req.method,
      headers,
      body,
    });

    const responseBody = await response.arrayBuffer();
    const bodyBytes = new Uint8Array(responseBody);

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: bodyBytes,
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Input
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowInput {
  // One of these is set depending on the trigger path
  manualDisputeId?: string;
  pendingDisputes?: Array<{ disputeId: string }>;

  secrets: CRESecrets;
  env: CREEnv;
}

function getInput(): WorkflowInput {
  // @ts-ignore — injected by CRE runtime
  if (typeof __INPUT !== 'undefined') return JSON.parse(__INPUT) as WorkflowInput;

  // Local simulation: read from env
  return {
    manualDisputeId: process.env.DISPUTE_ID,
    secrets: {
      anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
      openaiKey: process.env.OPENAI_API_KEY ?? '',
      mistralKey: process.env.MISTRAL_API_KEY ?? '',
      operatorPrivKey: process.env.OPERATOR_PRIVATE_KEY ?? '',
      evidenceKey: process.env.EVIDENCE_SERVER_KEY ?? '',
      rpcUrl: process.env.RPC_URL ?? '',
    },
    env: {
      registryContract: process.env.REGISTRY_CONTRACT ?? '',
      verifierContract: process.env.VERIFIER_CONTRACT ?? '',
      evidenceServerUrl: process.env.EVIDENCE_SERVER_URL ?? '',
      chainId: process.env.CHAIN_ID ?? '11155111',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Arbitration Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the complete arbitration pipeline for a single dispute.
 * This is the core function — called once per dispute.
 */
async function resolveDispute(
  disputeId: string,
  secrets: CRESecrets,
  env: CREEnv,
  stdHttp: HttpFetchFn,
  confidentialHttp: HttpFetchFn
): Promise<WorkflowOutput> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`ArbitrAI CRE Workflow — Resolving dispute ${disputeId}`);
  console.log(`${'═'.repeat(60)}\n`);

  const startTime = Date.now();

  // ── Step 1: Fetch dispute details from ArbitrationRegistry ──────────────
  console.log('[1/6] Fetching dispute from ArbitrationRegistry...');
  const dispute: DisputeRecord = await fetchDisputeFromChain(
    disputeId,
    env.registryContract,
    secrets.rpcUrl,
    stdHttp
  );

  console.log(`  Party A: ${dispute.partyA}`);
  console.log(`  Party B: ${dispute.partyB}`);
  console.log(`  Status:  ${dispute.status}`);
  console.log(`  Description: ${dispute.description.slice(0, 80)}...`);

  if (dispute.status !== 'IN_ARBITRATION') {
    throw new Error(
      `Dispute ${disputeId} is not ready for arbitration. Status: ${dispute.status}`
    );
  }

  if (dispute.evidenceHashA === '0x' + '0'.repeat(64) || dispute.evidenceHashB === '0x' + '0'.repeat(64)) {
    throw new Error(`Dispute ${disputeId} has missing evidence hashes — both parties must submit evidence first`);
  }

  // ── Step 2: Fetch encrypted evidence via Confidential HTTP ───────────────
  // This is the Privacy prize track feature:
  // - The HTTP calls are marked confidential in workflow.yaml
  // - Evidence content is processed inside CRE TEE
  // - Content hash is verified against on-chain value
  console.log('\n[2/6] Fetching evidence via Confidential HTTP...');
  const [evidenceA, evidenceB] = await fetchBothEvidences(
    dispute,
    env.evidenceServerUrl,
    secrets.evidenceKey,
    confidentialHttp  // ← Confidential HTTP capability
  );

  // IMPORTANT: Evidence content is logged locally for debugging but
  // the CRE confidential capability prevents it from appearing in DON logs
  console.log(`  ✓ Evidence A fetched and verified (${evidenceA.content.length} chars)`);
  console.log(`  ✓ Evidence B fetched and verified (${evidenceB.content.length} chars)`);

  // ── Step 3: Build the arbitration prompt ─────────────────────────────────
  console.log('\n[3/6] Building arbitration prompt (identical for all models)...');
  const prompt: ArbitrationPrompt = {
    disputeId,
    description: dispute.description,
    partyAAddress: dispute.partyA,
    partyBAddress: dispute.partyB,
    evidenceA: evidenceA.content,
    evidenceB: evidenceB.content,
  };

  // ── Step 4: Query all 3 AI models in parallel ────────────────────────────
  console.log('\n[4/6] Querying Claude, GPT-4o, and Mistral in parallel...');
  const modelVotes = await queryAllModels(
    prompt,
    { anthropicKey: secrets.anthropicKey, openaiKey: secrets.openaiKey, mistralKey: secrets.mistralKey },
    stdHttp  // Standard HTTP for AI APIs (they're public endpoints)
  );

  // ── Step 5: Apply 2/3 consensus logic ────────────────────────────────────
  console.log('\n[5/6] Applying 2/3 consensus logic...');
  const consensus = applyConsensus(modelVotes);
  console.log(`  Outcome:   ${consensus.finalOutcome}`);
  console.log(`  Consensus: ${consensus.consensusCount}/3`);
  console.log(`  Confidence: ${(consensus.aggregateConfidenceBps / 100).toFixed(1)}%`);
  console.log(`  Reasoning: ${consensus.reasoning}`);

  // ── Step 6: Build and sign the verdict ───────────────────────────────────
  console.log('\n[6/6] Signing verdict with CRE operator key...');

  const workflowRunId = '0x' + bytesToHex(
    keccak_256(new TextEncoder().encode(
      disputeId + Date.now().toString() + Math.random().toString()
    ))
  );

  const verdict: WorkflowVerdict = {
    disputeId,
    finalOutcome: consensus.finalOutcome,
    modelVotes: [
      {
        modelId: modelVotes[0].modelId,
        vote: modelVotes[0].vote,
        confidenceBps: Math.round(modelVotes[0].confidencePct * 100),
        reasoning: modelVotes[0].reasoning,
        reasoningHash: '',  // computed in signer
      },
      {
        modelId: modelVotes[1].modelId,
        vote: modelVotes[1].vote,
        confidenceBps: Math.round(modelVotes[1].confidencePct * 100),
        reasoning: modelVotes[1].reasoning,
        reasoningHash: '',
      },
      {
        modelId: modelVotes[2].modelId,
        vote: modelVotes[2].vote,
        confidenceBps: Math.round(modelVotes[2].confidencePct * 100),
        reasoning: modelVotes[2].reasoning,
        reasoningHash: '',
      },
    ],
    consensusCount: consensus.consensusCount,
    evidenceHashA: dispute.evidenceHashA,
    evidenceHashB: dispute.evidenceHashB,
    executedAt: Math.floor(Date.now() / 1000),
    workflowRunId,
  };

  const signature = signVerdict(verdict, secrets.operatorPrivKey);
  console.log(`  Signature: ${signature.slice(0, 20)}...`);

  // ── Build output ──────────────────────────────────────────────────────────
  const output = buildWorkflowOutput(verdict, signature);

  const elapsedMs = Date.now() - startTime;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Workflow complete in ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log(`Verdict: ${verdict.finalOutcome} (${consensus.consensusCount}/3 consensus)`);
  console.log(`${'─'.repeat(60)}\n`);

  return output;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const input = getInput();
  const { secrets, env } = input;

  // Validate required secrets
  const missingSecrets = [];
  if (!secrets.anthropicKey) missingSecrets.push('anthropicKey');
  if (!secrets.openaiKey) missingSecrets.push('openaiKey');
  if (!secrets.mistralKey) missingSecrets.push('mistralKey');
  if (!secrets.operatorPrivKey) missingSecrets.push('operatorPrivKey');
  if (missingSecrets.length > 0) {
    throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
  }

  const stdHttp = buildHttpFetch(false);
  const confidentialHttp = buildHttpFetch(true);

  // Collect dispute IDs to process
  const disputeIds: string[] = [];

  if (input.manualDisputeId) {
    // Manual trigger: process single dispute
    disputeIds.push(input.manualDisputeId);
  } else if (input.pendingDisputes && input.pendingDisputes.length > 0) {
    // Cron trigger: process all pending disputes
    disputeIds.push(...input.pendingDisputes.map((d) => d.disputeId));
    console.log(`[main] Cron trigger: found ${disputeIds.length} disputes to process`);
  } else {
    console.log('[main] No disputes pending. Workflow complete.');
    writeOutput({ disputeId: '', calldata: '0x', verdictSummary: 'No disputes', signature: '0x' });
    return;
  }

  // Process disputes sequentially (one per workflow run to stay within timeout)
  // In production, each dispute gets its own workflow invocation
  const disputeId = disputeIds[0];

  const output = await resolveDispute(disputeId, secrets, env, stdHttp, confidentialHttp);

  // In CRE: write output for Ethereum Transaction Writer
  writeOutput(output);

  // In local mode: also submit on-chain directly
  if (process.env.SUBMIT_ONCHAIN === 'true') {
    const chainId = parseInt(env.chainId, 10);
    const txHash = await submitVerdictOnChain(
      // Reconstruct verdict from output for direct submission
      {} as WorkflowVerdict,  // In real flow, verdict is already in memory
      env.verifierContract,
      secrets.operatorPrivKey,
      secrets.rpcUrl,
      chainId,
      stdHttp
    );
    console.log(`[main] Transaction submitted: ${txHash}`);
  }
}

function writeOutput(output: WorkflowOutput): void {
  // @ts-ignore — CRE global
  if (typeof __OUTPUT !== 'undefined') {
    // @ts-ignore
    __OUTPUT = JSON.stringify(output);
  } else {
    // Local mode: print to stdout
    console.log('\n=== WORKFLOW OUTPUT ===');
    console.log(JSON.stringify(output, null, 2));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WASM Entry Point
// ─────────────────────────────────────────────────────────────────────────────

// CRE WASM entry point — called by Javy runtime
// @ts-ignore
if (typeof __main === 'undefined') {
  main().catch((err) => {
    console.error('[FATAL] Workflow failed:', err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) console.error(err.stack);
    process.exit(1);
  });
}

// Export for WASM compilation
export { main as __main };
