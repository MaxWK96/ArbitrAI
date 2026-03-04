/**
 * ArbitrAI CRE Workflow — Evidence Fetcher (Confidential HTTP)
 *
 * This module fetches dispute evidence via Chainlink Confidential HTTP.
 *
 * Privacy architecture:
 *  - Parties submit evidence to the ArbitrAI evidence server via HTTPS
 *  - The evidence server stores content encrypted at rest
 *  - The on-chain transaction records ONLY the keccak256 hash of the evidence
 *  - The CRE workflow fetches evidence via Confidential HTTP:
 *      → The request/response is processed in a Trusted Execution Environment
 *      → The evidence content NEVER appears in workflow execution logs
 *      → ONLY the hash is verified on-chain
 *  - This provides the Privacy prize track requirement: evidence is private
 *    even from Chainlink node operators
 *
 * Prize tracks: Privacy (Confidential HTTP), CRE & AI
 */

import type { Evidence, DisputeRecord } from './types.js';
import type { HttpFetchFn } from './models.js';
import { decodeAbiParameters } from 'viem';

/** keccak256 implementation using @noble/hashes (pure JS, WASM-compatible) */
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

function keccak256Hex(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const hash = keccak_256(bytes);
  return '0x' + bytesToHex(hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain dispute data fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch dispute details from ArbitrationRegistry via RPC call.
 * This is a standard HTTP call (not confidential) since the registry is public.
 */
export async function fetchDisputeFromChain(
  disputeId: string,
  registryContract: string,
  rpcUrl: string,
  httpFetch: HttpFetchFn
): Promise<DisputeRecord> {
  // ABI encode call to getDispute(bytes32)
  // Function selector: keccak256("getDispute(bytes32)")[0:4]
  const selector = '0x136ba6aa'; // getDispute(bytes32)
  const paddedDisputeId = disputeId.replace('0x', '').padStart(64, '0');
  const calldata = selector + paddedDisputeId;

  const rpcBody = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [
      { to: registryContract, data: calldata },
      'latest',
    ],
  });

  const response = await httpFetch({
    method: 'POST',
    url: rpcUrl,
    headers: { 'content-type': 'application/json' },
    body: Buffer.from(rpcBody).toString('base64'),
  });

  const responseText = Buffer.from(response.body).toString('utf-8');
  const rpcResponse = JSON.parse(responseText) as {
    result?: string;
    error?: { message: string };
  };

  if (rpcResponse.error) {
    throw new Error(`RPC error fetching dispute: ${rpcResponse.error.message}`);
  }

  // Decode the ABI-encoded DisputeRecord tuple
  // (simplified decoder — in production use viem's decodeAbiParameters)
  return decodeDisputeRecord(rpcResponse.result ?? '0x', disputeId);
}

const DISPUTE_RECORD_ABI = [
  {
    type: 'tuple',
    components: [
      { name: 'id',                 type: 'bytes32'  },
      { name: 'partyA',             type: 'address'  },
      { name: 'partyB',             type: 'address'  },
      { name: 'amount',             type: 'uint256'  },
      { name: 'status',             type: 'uint8'    },
      { name: 'evidenceHashA',      type: 'bytes32'  },
      { name: 'evidenceHashB',      type: 'bytes32'  },
      { name: 'workflowOutputHash', type: 'bytes32'  },
      { name: 'createdAt',          type: 'uint256'  },
      { name: 'settledAt',          type: 'uint256'  },
      { name: 'winner',             type: 'address'  },
      { name: 'description',        type: 'string'   },
    ],
  },
] as const;

const STATUS_MAP: Record<number, string> = {
  0: 'NONE', 1: 'PENDING', 2: 'ACTIVE', 3: 'IN_ARBITRATION',
  4: 'SETTLED', 5: 'REFUNDED', 6: 'ESCALATED',
};

/**
 * Decode the ABI-encoded DisputeRecord tuple returned by getDispute(bytes32).
 * Uses viem decodeAbiParameters for exact, correct ABI decoding.
 */
function decodeDisputeRecord(encoded: string, disputeId: string): DisputeRecord {
  const [record] = decodeAbiParameters(DISPUTE_RECORD_ABI, encoded as `0x${string}`);

  return {
    id:            record.id,
    partyA:        record.partyA.toLowerCase(),
    partyB:        record.partyB.toLowerCase(),
    amount:        record.amount.toString(),
    status:        STATUS_MAP[record.status] ?? 'UNKNOWN',
    evidenceHashA: record.evidenceHashA,
    evidenceHashB: record.evidenceHashB,
    createdAt:     Number(record.createdAt),
    description:   record.description,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidential Evidence Fetcher
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch evidence for one party via Chainlink Confidential HTTP.
 *
 * The "confidential" designation in workflow.yaml tells the CRE runtime to:
 *  1. Execute this HTTP request inside the TEE
 *  2. Redact the request/response from all execution logs
 *  3. Only expose the computed hash (not the content) to other workflow steps
 *
 * From the user's perspective: they submit evidence to the ArbitrAI server,
 * the server stores it, and only the CRE TEE can read the actual content.
 */
export async function fetchEvidenceConfidential(
  disputeId: string,
  partyLabel: 'A' | 'B',
  partyAddress: string,
  expectedHash: string,
  evidenceServerUrl: string,
  evidenceApiKey: string,
  httpFetch: HttpFetchFn
): Promise<Evidence> {
  console.log(
    `[evidence] Fetching evidence for party ${partyLabel} via Confidential HTTP (content will not appear in logs)`
  );

  const url = `${evidenceServerUrl}/api/evidence/${disputeId}/${partyLabel.toLowerCase()}`;

  const response = await httpFetch({
    method: 'GET',
    url,
    headers: {
      // Evidence server requires auth — stored in CRE secrets, never logged
      Authorization: `Bearer ${evidenceApiKey}`,
      'X-Dispute-Id': disputeId,
      'X-Party': partyLabel,
    },
  });

  if (response.statusCode !== 200) {
    throw new Error(
      `Evidence server returned ${response.statusCode} for party ${partyLabel}. ` +
      `Has evidence been submitted for this dispute?`
    );
  }

  const responseText = Buffer.from(response.body).toString('utf-8');
  const evidenceData = JSON.parse(responseText) as {
    content: string;
    submittedAt: number;
    partyAddress: string;
  };

  // ── CRITICAL: Verify evidence integrity ──────────────────────────────────
  // The evidence content we received must hash to the value stored on-chain.
  // If it doesn't, the evidence was tampered with after submission.
  // The workflow HALTS if evidence integrity fails.
  const computedHash = keccak256Hex(evidenceData.content);

  if (computedHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(
      `Evidence integrity check FAILED for party ${partyLabel}! ` +
      `On-chain hash: ${expectedHash} | ` +
      `Computed hash: ${computedHash}. ` +
      `Evidence may have been tampered with — aborting arbitration.`
    );
  }

  console.log(`[evidence] Party ${partyLabel} evidence verified. Hash: ${computedHash.slice(0, 10)}...`);

  return {
    partyAddress,
    partyLabel,
    content: evidenceData.content,
    submittedAt: evidenceData.submittedAt,
    contentHash: computedHash,
  };
}

/**
 * Fetch both parties' evidence concurrently.
 * Returns [evidenceA, evidenceB].
 */
export async function fetchBothEvidences(
  dispute: DisputeRecord,
  evidenceServerUrl: string,
  evidenceApiKey: string,
  httpFetch: HttpFetchFn
): Promise<[Evidence, Evidence]> {
  const [evidenceA, evidenceB] = await Promise.all([
    fetchEvidenceConfidential(
      dispute.id,
      'A',
      dispute.partyA,
      dispute.evidenceHashA,
      evidenceServerUrl,
      evidenceApiKey,
      httpFetch
    ),
    fetchEvidenceConfidential(
      dispute.id,
      'B',
      dispute.partyB,
      dispute.evidenceHashB,
      evidenceServerUrl,
      evidenceApiKey,
      httpFetch
    ),
  ]);

  return [evidenceA, evidenceB];
}
