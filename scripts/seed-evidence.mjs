#!/usr/bin/env node
/**
 * seed-evidence.mjs
 *
 * Submits demo evidence to an already-running evidence server.
 * Use this for the manual demo flow:
 *
 *   Terminal 1: cd evidence-server && npm start
 *   Terminal 2: node scripts/seed-evidence.mjs
 *               npm run simulate
 *
 * Reads config from cre-workflow/.env (DISPUTE_ID, EVIDENCE_SERVER_KEY).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const ENV_PATH  = join(ROOT, 'cre-workflow', '.env');

function loadEnv(path) {
  const env = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const env          = loadEnv(ENV_PATH);
const DISPUTE_ID   = env.DISPUTE_ID ?? '0x0442170ea59ff899df64464d8e0be7601eaa53ada5bd924c90a221f544284ec0';
const EVIDENCE_KEY = env.EVIDENCE_SERVER_KEY ?? 'arbitrai-dev-key-change-in-production';
const PORT         = 3002;

// These strings must match exactly what was hashed on-chain in CreateDemoDispute.s.sol.
// keccak256(A) = 0xace483ba1cd1aceb9857e2993cae9feeddd6869bdbb4a0a8932dcb1037135b20
// keccak256(B) = 0x74d8cb8aa31efd9cc848d46ad4280a1fd81d5e94bfed0bade362d59a3736764e
const DEMO_EVIDENCE = {
  a: {
    content:      'Alice evidence: GitHub repo link, design file, client sign-off email.',
    partyAddress: '0xaC266469bB463Ec83E2D6845e513d47B191739B0',
  },
  b: {
    content:      'Bob evidence: Screenshot of broken mobile layout, missing accessibility features.',
    partyAddress: '0xEe6cadE823BB01321Fa753FC0E89bd9402A04Dd7',
  },
};

async function submitEvidence(party, content, partyAddress) {
  const res = await fetch(`http://localhost:${PORT}/api/evidence/${DISPUTE_ID}/${party}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EVIDENCE_KEY}` },
    body:    JSON.stringify({ content, partyAddress }),
  });
  const body = await res.json();
  if (res.status === 409) {
    console.log(`  Party ${party.toUpperCase()} evidence already present`);
    return;
  }
  if (!res.ok) throw new Error(`Failed to seed party ${party.toUpperCase()} evidence (${res.status}): ${JSON.stringify(body)}`);
  console.log(`  Party ${party.toUpperCase()} stored — hash: ${String(body.contentHash).slice(0, 14)}...`);
}

async function main() {
  console.log(`[seed] Dispute: ${DISPUTE_ID}`);
  console.log('[seed] Submitting demo evidence to localhost:' + PORT + '...');
  await submitEvidence('a', DEMO_EVIDENCE.a.content, DEMO_EVIDENCE.a.partyAddress);
  await submitEvidence('b', DEMO_EVIDENCE.b.content, DEMO_EVIDENCE.b.partyAddress);
  console.log('[seed] Done.');
}

main().catch(err => {
  console.error('[seed] Error:', err.message);
  console.error('       Is the evidence server running? (cd evidence-server && npm start)');
  process.exit(1);
});
