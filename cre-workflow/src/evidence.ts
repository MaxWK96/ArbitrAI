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
  const selector = '0x6000a5dc'; // getDispute(bytes32)
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

/**
 * Simple ABI decoder for DisputeRecord tuple.
 * Decodes the on-chain struct returned by getDispute(bytes32).
 */
function decodeDisputeRecord(encoded: string, disputeId: string): DisputeRecord {
  // Strip 0x prefix
  const hex = encoded.replace('0x', '');

  if (hex.length < 64 * 10) {
    throw new Error(`Response too short to decode DisputeRecord: ${hex.length} chars`);
  }

  // ABI struct fields (each 32 bytes = 64 hex chars):
  // [0]  id (bytes32)
  // [1]  partyA (address, left-padded)
  // [2]  partyB (address, left-padded)
  // [3]  amount (uint256)
  // [4]  status (uint8)
  // [5]  evidenceHashA (bytes32)
  // [6]  evidenceHashB (bytes32)
  // [7]  workflowOutputHash (bytes32)
  // [8]  createdAt (uint256)
  // [9]  settledAt (uint256)
  // [10] winner (address, left-padded)
  // [11+] description (string — dynamic)

  const slot = (i: number) => hex.slice(i * 64, (i + 1) * 64);

  const readAddress = (i: number) => '0x' + slot(i).slice(24).toLowerCase();
  const readBytes32 = (i: number) => '0x' + slot(i);
  const readUint = (i: number) => parseInt(slot(i), 16);

  const statusMap: Record<number, string> = {
    0: 'NONE', 1: 'PENDING', 2: 'ACTIVE', 3: 'IN_ARBITRATION',
    4: 'SETTLED', 5: 'REFUNDED', 6: 'ESCALATED',
  };

  // Description is dynamic — simplified: read offset and length
  const descOffset = readUint(11) / 32;
  const descLength = readUint(descOffset);
  const descHex = hex.slice((descOffset + 1) * 64, (descOffset + 1) * 64 + descLength * 2);
  const description = Buffer.from(descHex, 'hex').toString('utf-8');

  return {
    id: readBytes32(0),
    partyA: readAddress(1),
    partyB: readAddress(2),
    amount: slot(3),
    status: statusMap[readUint(4)] ?? 'UNKNOWN',
    evidenceHashA: readBytes32(5),
    evidenceHashB: readBytes32(6),
    createdAt: readUint(8),
    description,
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
