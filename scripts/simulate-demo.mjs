#!/usr/bin/env node
/**
 * simulate-demo.mjs
 *
 * Orchestrates a full ArbitrAI workflow demo for a single command:
 *   npm run simulate:demo
 *
 * What this does:
 *   1. Reads cre-workflow/.env (all config lives there)
 *   2. Checks that real API keys are present — exits early with clear message if not
 *   3. Starts the evidence server in the background
 *   4. Seeds both parties' demo evidence (content that hash-matches on-chain commitments)
 *   5. Runs `npm run simulate` — the full 6-step CRE workflow
 *   6. Kills the evidence server on exit
 *
 * Prerequisites (see README for full setup):
 *   - cre-workflow/.env with real ANTHROPIC_API_KEY, OPENAI_API_KEY, MISTRAL_API_KEY
 *   - Node.js 20+
 *   - npm install run in cre-workflow/ and evidence-server/
 */

import { spawn }       from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');
const ENV_PATH  = join(ROOT, 'cre-workflow', '.env');

// ─── Load cre-workflow/.env ───────────────────────────────────────────────────

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

const env = loadEnv(ENV_PATH);

// ─── Config ───────────────────────────────────────────────────────────────────

const DISPUTE_ID    = env.DISPUTE_ID    ?? '0x0442170ea59ff899df64464d8e0be7601eaa53ada5bd924c90a221f544284ec0';
const EVIDENCE_KEY  = env.EVIDENCE_SERVER_KEY ?? 'arbitrai-dev-key-change-in-production';
const PORT          = 3002;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isPlaceholder(val) {
  return !val || val.startsWith('sk-ant-...') || val === 'sk-...' || val === '...'
    || val.startsWith('YOUR_') || val === '0x...';
}

async function waitForServer(timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}/health`);
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('Evidence server did not start within 12s. Check evidence-server/src/server.ts.');
}

async function submitEvidence(party, content, partyAddress) {
  const res = await fetch(`http://localhost:${PORT}/api/evidence/${DISPUTE_ID}/${party}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EVIDENCE_KEY}` },
    body:    JSON.stringify({ content, partyAddress }),
  });
  const body = await res.json();
  if (res.status === 409) {
    console.log(`  [demo] Party ${party.toUpperCase()} evidence already present`);
    return;
  }
  if (!res.ok) throw new Error(`Failed to seed party ${party.toUpperCase()} evidence (${res.status}): ${JSON.stringify(body)}`);
  console.log(`  [demo] Party ${party.toUpperCase()} stored — hash: ${String(body.contentHash).slice(0, 14)}...`);
}

// ─── Shared: start server + seed evidence ────────────────────────────────────

async function startServerAndSeed() {
  console.log(`[demo] Dispute: ${DISPUTE_ID}`);
  console.log('[demo] Starting evidence server...');

  const server = spawn(
    'cmd', ['/c', 'npm', 'start'],
    { cwd: join(ROOT, 'evidence-server'), stdio: ['ignore', 'pipe', 'pipe'] }
  );

  server.stderr.on('data', d => process.stderr.write('[server] ' + d));
  server.stdout.on('data', d => {
    const msg = d.toString();
    if (msg.includes('Error') || msg.includes('error')) process.stderr.write('[server] ' + msg);
  });

  const cleanup = () => { try { server.kill('SIGTERM'); } catch {} };
  process.on('exit',   cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  await waitForServer();
  console.log('[demo] Evidence server ready\n');

  console.log('[demo] Seeding demo evidence...');
  await submitEvidence('a', DEMO_EVIDENCE.a.content, DEMO_EVIDENCE.a.partyAddress);
  await submitEvidence('b', DEMO_EVIDENCE.b.content, DEMO_EVIDENCE.b.partyAddress);
  console.log('[demo] Evidence seeded\n');

  return cleanup;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          ArbitrAI — Full CRE Workflow Demo                   ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Check API keys before spending time starting servers
  const missing = [];
  if (isPlaceholder(env.ANTHROPIC_API_KEY)) missing.push('ANTHROPIC_API_KEY');
  if (isPlaceholder(env.OPENAI_API_KEY))    missing.push('OPENAI_API_KEY');
  if (isPlaceholder(env.MISTRAL_API_KEY))   missing.push('MISTRAL_API_KEY');

  if (missing.length > 0) {
    console.error('❌  Missing real API keys in cre-workflow/.env:\n');
    for (const k of missing) console.error(`    ${k}=<your real key here>`);
    console.error('\nGet keys from:');
    console.error('  Anthropic → https://console.anthropic.com/');
    console.error('  OpenAI    → https://platform.openai.com/api-keys');
    console.error('  Mistral   → https://console.mistral.ai/api-keys/');
    console.error('\nThen re-run: npm run simulate:demo\n');
    process.exit(1);
  }

  console.log('[demo] API keys found for: Anthropic, OpenAI, Mistral');

  const cleanup = await startServerAndSeed();

  // Run the CRE workflow
  const simulate = spawn('npm', ['run', 'simulate'], {
    cwd:   ROOT,
    env:   { ...process.env },
    stdio: 'inherit',
    shell: true,
  });

  await new Promise((resolve, reject) => {
    simulate.on('close', code => {
      cleanup();
      if (code === 0 || code === null) resolve();
      else reject(new Error(`simulate exited with code ${code}`));
    });
  });
}

main().catch(err => {
  console.error('\n[demo] Fatal error:', err.message);
  process.exit(1);
});
