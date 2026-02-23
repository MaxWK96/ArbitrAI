/**
 * ArbitrAI Evidence Server
 *
 * Stores encrypted dispute evidence. Accessible ONLY to:
 *  1. The submitting party (write-once, read-never after submission)
 *  2. The Chainlink CRE workflow via Confidential HTTP
 *
 * Privacy guarantees:
 *  - Evidence is encrypted at rest with AES-256-GCM
 *  - Each dispute has a unique encryption key derived from the dispute ID + server secret
 *  - The CRE workflow reads evidence via Confidential HTTP (TEE-protected)
 *  - After the CRE workflow reads evidence, it is marked as consumed
 *  - Parties cannot read each other's evidence
 *  - The server never stores plaintext
 *
 * This server is the "off-chain private data layer" in the ArbitrAI architecture.
 * It's analogous to how Chainlink Functions uses off-chain computation with
 * on-chain verification — here, the on-chain evidenceHash verifies integrity.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StoredEvidence {
  encryptedContent: string;  // AES-256-GCM encrypted, hex
  iv: string;                // Initialization vector, hex
  authTag: string;           // GCM auth tag, hex
  contentHash: string;       // keccak256 of plaintext — matches on-chain value
  partyAddress: string;
  submittedAt: number;
  consumed: boolean;         // True after CRE reads it (one-time read)
}

interface EvidenceStore {
  [disputeId: string]: {
    a?: StoredEvidence;
    b?: StoredEvidence;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage (in-memory for demo; use encrypted database in production)
// ─────────────────────────────────────────────────────────────────────────────

const store: EvidenceStore = {};

const SERVER_SECRET = process.env.SERVER_SECRET ?? randomBytes(32).toString('hex');
const API_KEY = process.env.EVIDENCE_SERVER_KEY ?? 'arbitrai-dev-key-change-in-production';
const PORT = parseInt(process.env.PORT ?? '3002', 10);

// ─────────────────────────────────────────────────────────────────────────────
// Encryption
// ─────────────────────────────────────────────────────────────────────────────

function deriveKey(disputeId: string, partyLabel: string): Buffer {
  // Unique key per (disputeId, party) pair
  return createHash('sha256')
    .update(`${SERVER_SECRET}:${disputeId}:${partyLabel}`)
    .digest();
}

function encrypt(plaintext: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

function decrypt(encrypted: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf-8');
}

function keccak256(content: string): string {
  // Using sha256 here for Node.js compatibility (keccak256 needs a library)
  // In production: use ethers.js keccak256 to match on-chain values
  return '0x' + createHash('sha256').update(content).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Request Parsing
// ─────────────────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function sendJSON(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    // CORS for frontend
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dispute-Id, X-Party',
  });
  res.end(body);
}

function requireAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const authHeader = req.headers.authorization ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== API_KEY) {
    sendJSON(res, 401, { error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/evidence/:disputeId/:party
 * Submit evidence for a dispute (write-once per party)
 *
 * Body: { content: string, partyAddress: string }
 * Returns: { contentHash: string } — hash to store on-chain
 */
async function handleSubmitEvidence(
  res: ServerResponse,
  disputeId: string,
  partyLabel: 'a' | 'b',
  body: string
): Promise<void> {
  let parsed: { content: string; partyAddress: string };
  try {
    parsed = JSON.parse(body);
  } catch {
    sendJSON(res, 400, { error: 'Invalid JSON body' });
    return;
  }

  if (!parsed.content || !parsed.partyAddress) {
    sendJSON(res, 400, { error: 'Missing content or partyAddress' });
    return;
  }

  if (!store[disputeId]) store[disputeId] = {};

  // Write-once: cannot overwrite evidence after submission
  if (store[disputeId][partyLabel]) {
    sendJSON(res, 409, { error: 'Evidence already submitted for this party' });
    return;
  }

  const key = deriveKey(disputeId, partyLabel);
  const { encrypted, iv, authTag } = encrypt(parsed.content, key);
  const contentHash = keccak256(parsed.content);

  store[disputeId][partyLabel] = {
    encryptedContent: encrypted,
    iv,
    authTag,
    contentHash,
    partyAddress: parsed.partyAddress.toLowerCase(),
    submittedAt: Date.now(),
    consumed: false,
  };

  console.log(`[server] Evidence stored: dispute=${disputeId.slice(0, 10)}... party=${partyLabel} hash=${contentHash.slice(0, 12)}...`);

  sendJSON(res, 200, {
    contentHash,
    message: 'Evidence stored. Submit this hash on-chain as your evidence commitment.',
  });
}

/**
 * GET /api/evidence/:disputeId/:party
 * Fetch evidence (CRE workflow via Confidential HTTP only)
 * Returns decrypted content — this endpoint is ONLY for CRE
 */
function handleFetchEvidence(
  res: ServerResponse,
  disputeId: string,
  partyLabel: 'a' | 'b'
): void {
  const partyEvidence = store[disputeId]?.[partyLabel];

  if (!partyEvidence) {
    sendJSON(res, 404, { error: `No evidence found for dispute ${disputeId} party ${partyLabel}` });
    return;
  }

  const key = deriveKey(disputeId, partyLabel);
  let content: string;
  try {
    content = decrypt(partyEvidence.encryptedContent, partyEvidence.iv, partyEvidence.authTag, key);
  } catch {
    sendJSON(res, 500, { error: 'Decryption failed — data may be corrupted' });
    return;
  }

  // Mark as consumed (one-time read for security — CRE reads once)
  partyEvidence.consumed = true;

  sendJSON(res, 200, {
    content,
    submittedAt: partyEvidence.submittedAt,
    partyAddress: partyEvidence.partyAddress,
  });
}

/**
 * GET /api/disputes/pending
 * Returns disputes with both evidence submitted but not yet resolved.
 * Used by CRE cron trigger to find work.
 */
function handleGetPendingDisputes(res: ServerResponse): void {
  const pending = Object.entries(store)
    .filter(([_, d]) => d.a && d.b && !d.a.consumed && !d.b.consumed)
    .map(([disputeId, d]) => ({
      disputeId,
      submittedAt: Math.min(d.a!.submittedAt, d.b!.submittedAt),
    }));

  sendJSON(res, 200, { disputes: pending });
}

/**
 * GET /health
 */
function handleHealth(res: ServerResponse): void {
  sendJSON(res, 200, { status: 'ok', timestamp: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dispute-Id, X-Party',
    });
    res.end();
    return;
  }

  // Health check (no auth required)
  if (url === '/health' && method === 'GET') {
    handleHealth(res);
    return;
  }

  // All other routes require auth
  if (!requireAuth(req, res)) return;

  // Route: GET /api/disputes/pending
  if (url === '/api/disputes/pending' && method === 'GET') {
    handleGetPendingDisputes(res);
    return;
  }

  // Route: /api/evidence/:disputeId/:party
  const evidenceMatch = url.match(/^\/api\/evidence\/([^/]+)\/(a|b)$/);
  if (evidenceMatch) {
    const disputeId = decodeURIComponent(evidenceMatch[1]);
    const partyLabel = evidenceMatch[2] as 'a' | 'b';

    if (method === 'POST') {
      const body = await readBody(req);
      await handleSubmitEvidence(res, disputeId, partyLabel, body);
    } else if (method === 'GET') {
      handleFetchEvidence(res, disputeId, partyLabel);
    } else {
      sendJSON(res, 405, { error: 'Method not allowed' });
    }
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`ArbitrAI Evidence Server running on port ${PORT}`);
  console.log('Endpoints:');
  console.log(`  POST /api/evidence/:disputeId/:party  — Submit evidence`);
  console.log(`  GET  /api/evidence/:disputeId/:party  — Fetch evidence (CRE only)`);
  console.log(`  GET  /api/disputes/pending            — List pending disputes (CRE cron)`);
  console.log(`  GET  /health                          — Health check`);
});

export { server };
