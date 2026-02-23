/**
 * Evidence submission client for ArbitrAI frontend.
 * Communicates with the evidence server — NOT with the blockchain directly.
 * The content hash returned is what the user submits on-chain.
 */

const EVIDENCE_SERVER = import.meta.env.VITE_EVIDENCE_SERVER_URL ?? 'http://localhost:3002';

/**
 * Compute keccak256 of evidence content in the browser.
 * We use ethers.js for this since it matches the on-chain value.
 */
export async function hashEvidence(content: string): Promise<string> {
  const { ethers } = await import('ethers');
  return ethers.keccak256(ethers.toUtf8Bytes(content));
}

/**
 * Submit evidence to the private evidence server.
 * Returns the content hash to submit on-chain.
 *
 * Privacy: the content goes to the evidence server (private, authenticated).
 * Only the hash goes on-chain. The CRE workflow fetches the content via
 * Confidential HTTP and verifies the hash matches before processing.
 */
export async function submitEvidence(
  disputeId: string,
  partyLabel: 'a' | 'b',
  content: string,
  partyAddress: string
): Promise<{ contentHash: string }> {
  const response = await fetch(`${EVIDENCE_SERVER}/api/evidence/${disputeId}/${partyLabel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_EVIDENCE_SERVER_KEY ?? 'arbitrai-dev-key-change-in-production'}`,
    },
    body: JSON.stringify({ content, partyAddress }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error((err as { error: string }).error ?? `Server error ${response.status}`);
  }

  return response.json() as Promise<{ contentHash: string }>;
}
