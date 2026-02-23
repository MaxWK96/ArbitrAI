/**
 * DemoPage — Self-running interactive demo for hackathon judges.
 *
 * Three scenarios:
 *   Happy Path      — 3/3 consensus, Alice wins, escrow released
 *   No Consensus    — models disagree, circuit breaker, full refund
 *   Circuit Breaker — one model API fails, safety triggered, full refund
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ExternalLink } from 'lucide-react';
import { applyConsensus } from '../lib/cre/consensus.ts';
import type { VerdictOutcome, ParsedModelVerdict } from '../lib/cre/consensus.ts';

const ESCROW   = '0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7';
const REGISTRY = '0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5';
const VERIFIER = '0x18b34E31290Ac10dE263943cD9D617EE1f570133';
const SEP      = 'https://sepolia.etherscan.io';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelVote = {
  id:         string;
  name:       string;
  vote:       VerdictOutcome;
  confidence: number;
  reasoning:  string;
  failed?:    boolean;
};

type Scenario = {
  id:             'happy' | 'failure' | 'circuit';
  label:          string;
  tagline:        string;
  disputeId:      string;
  deposit:        string;
  partyA:         { name: string; addr: string };
  partyB:         { name: string; addr: string };
  description:    string;
  evidenceHashA:  string;
  evidenceHashB:  string;
  models:         ModelVote[];
  finalOutcome:   string;
  outcomeCls:     string;
  settlementNote: string;
};

const SCENARIOS: Scenario[] = [
  {
    id:          'happy',
    label:       'Happy Path',
    tagline:     '3/3 consensus — Alice wins',
    disputeId:   '0x2c4c798cbe05c34f71e541789a06e2fa1e8dac39c36636b1c47ebf3af6df1765',
    deposit:     '0.0100',
    partyA:      { name: 'Alice', addr: '0xaC266469bB463Ec83E2D6845e513d47B191739B0' },
    partyB:      { name: 'Bob',   addr: '0xEe6cadE823BB01321Fa753FC0E89bd9402A04Dd7' },
    description: 'Alice delivered a React dashboard. Bob claims quality issues.',
    evidenceHashA: '0x91c73ac36584f093e0aaaca7dd1cda5ede2bda713ea36e72173c6c34d1db4946',
    evidenceHashB: '0x511650fc7b9a4e8c14ce3e0bffd9746e0da4f165d1687515cc154418670a59d7',
    models: [
      { id:'claude-opus-4-6',    name:'Claude Opus 4.6', vote:'FAVOR_PARTY_A', confidence:87, reasoning:'Alice delivered all 5 screens on schedule. The scope was met. Bob\'s objections concern subjective design preferences not specified in the contract.' },
      { id:'gpt-4o',             name:'GPT-4o',          vote:'FAVOR_PARTY_A', confidence:82, reasoning:'Deliverables match original specification. Timeline was honored. Quality is subjective and was not formally defined in the agreement.' },
      { id:'mistral-large-2411', name:'Mistral Large',   vote:'FAVOR_PARTY_A', confidence:76, reasoning:'Evidence clearly supports Party A\'s delivery claims. Contract terms were satisfied per the submitted documentation.' },
    ],
    finalOutcome:   'FAVOR PARTY A — Alice Wins',
    outcomeCls:     'text-green-400',
    settlementNote: 'Alice receives 0.0198 ETH (99% of pool). Protocol fee: 0.0002 ETH (1%). Bob: 0 ETH.',
  },
  {
    id:          'failure',
    label:       'No Consensus',
    tagline:     'Models disagree — full refund',
    disputeId:   '0xf389a96562894d7a3b0b965eb4741f78cb3c4210bb751f23b3976dc6e2eec057',
    deposit:     '0.0100',
    partyA:      { name: 'Alice', addr: '0xaC266469bB463Ec83E2D6845e513d47B191739B0' },
    partyB:      { name: 'Bob',   addr: '0xEe6cadE823BB01321Fa753FC0E89bd9402A04Dd7' },
    description: 'Ambiguous contract: partial delivery, disputed milestones, insufficient evidence.',
    evidenceHashA: '0x3a7f2b9c1e4d8a6b5c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b',
    evidenceHashB: '0x8d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e',
    models: [
      { id:'claude-opus-4-6',    name:'Claude Opus 4.6', vote:'FAVOR_PARTY_A',         confidence:55, reasoning:'Lean toward Alice but confidence is low. The deliverable scope was partially met but contract terms are ambiguous.' },
      { id:'gpt-4o',             name:'GPT-4o',          vote:'FAVOR_PARTY_B',         confidence:52, reasoning:'Lean toward Bob. The quality requirements, while subjective, appear unmet based on the evidence provided.' },
      { id:'mistral-large-2411', name:'Mistral Large',   vote:'INSUFFICIENT_EVIDENCE', confidence:68, reasoning:'Cannot determine a winner from the available evidence. Additional documentation is required to make a fair ruling.' },
    ],
    finalOutcome:   'NO CONSENSUS — Full Refund',
    outcomeCls:     'text-red-400',
    settlementNote: 'Alice refunded 0.0100 ETH. Bob refunded 0.0100 ETH. No protocol fee on refunds.',
  },
  {
    id:          'circuit',
    label:       'Circuit Breaker',
    tagline:     'API failure — safety triggered',
    disputeId:   '0xd1b3e8a2c5f9071c48e36da2b97f4c1e8d3a6b9c2e5f8a1d4b7e3f6a9c2d5e8',
    deposit:     '0.0100',
    partyA:      { name: 'Alice', addr: '0xaC266469bB463Ec83E2D6845e513d47B191739B0' },
    partyB:      { name: 'Bob',   addr: '0xEe6cadE823BB01321Fa753FC0E89bd9402A04Dd7' },
    description: 'Alice claims payment for completed API integration. Bob disputes the deliverable.',
    evidenceHashA: '0x2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b',
    evidenceHashB: '0x4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4c6d',
    models: [
      { id:'claude-opus-4-6',    name:'Claude Opus 4.6', vote:'FAVOR_PARTY_A',  confidence:79, reasoning:'API integration was delivered per the spec. The endpoints work as documented.' },
      { id:'gpt-4o',             name:'GPT-4o',          vote:'CIRCUIT_BREAKER', confidence:0, reasoning:'Request timeout after 30s. Model unavailable.', failed: true },
      { id:'mistral-large-2411', name:'Mistral Large',   vote:'FAVOR_PARTY_A',  confidence:83, reasoning:'Evidence confirms the integration was completed and is functional.' },
    ],
    finalOutcome:   'CIRCUIT BREAKER — Safety Triggered',
    outcomeCls:     'text-orange-400',
    settlementNote: 'GPT-4o API failure detected. Safety mechanism activated. Both parties refunded in full. No fee.',
  },
];

const STEP_LABELS = [
  { label:'Dispute Created',         icon:'📋' },
  { label:'Bob Deposits',            icon:'💰' },
  { label:'Evidence Submitted',      icon:'🔐' },
  { label:'CRE Workflow Triggered',  icon:'⚡' },
  { label:'Confidential HTTP (TEE)', icon:'🛡️' },
  { label:'Model 1 Votes',           icon:'🤖' },
  { label:'Model 2 Votes',           icon:'🧠' },
  { label:'Model 3 Votes',           icon:'💡' },
  { label:'Consensus + ECDSA Sign',  icon:'✍️' },
  { label:'On-Chain Settlement',     icon:'🏆' },
];

const DELAYS = [800, 900, 1100, 700, 1300, 1500, 1500, 1500, 1200, 1400];

// ─── Small reusable components ────────────────────────────────────────────────

function EthLink({ href, label, cls = '' }: { href: string; label: string; cls?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
       className={`inline-flex items-center gap-1 font-body text-xs text-primary hover:text-primary/80 transition-colors mono ${cls}`}>
      {label}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function Hash({ v, label }: { v: string; label?: string }) {
  const short = `${v.slice(0,10)}…${v.slice(-6)}`;
  return (
    <span className="inline-flex items-center gap-1.5 bg-secondary border border-border rounded px-2 py-0.5 mono text-xs text-foreground">
      {label && <span className="text-muted-foreground">{label}</span>}
      <span title={v}>{short}</span>
    </span>
  );
}

function Spinner() {
  return <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin inline-block" />;
}

function ConfBar({ pct, cls = 'bg-primary' }: { pct: number; cls?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-secondary rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${cls}`} style={{ width:`${pct}%` }} />
      </div>
      <span className="w-9 text-right text-sm font-bold mono text-foreground">{pct}%</span>
    </div>
  );
}

function StepDot({ status }: { status: 'done' | 'running' | 'pending' }) {
  if (status === 'done')    return <div className="step-dot-done"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg></div>;
  if (status === 'running') return <div className="step-dot-running" />;
  return <div className="step-dot-pending" />;
}

const VOTE_COLORS: Record<string, string> = {
  FAVOR_PARTY_A:        'text-green-400  bg-green-950/50  border-green-800/60',
  FAVOR_PARTY_B:        'text-blue-400   bg-blue-950/50   border-blue-800/60',
  INSUFFICIENT_EVIDENCE:'text-yellow-400 bg-yellow-950/50 border-yellow-800/60',
  NO_CONSENSUS:         'text-muted-foreground bg-secondary border-border',
  CIRCUIT_BREAKER:      'text-red-400    bg-red-950/50    border-red-800/60',
};
const CONF_COLORS: Record<string, string> = {
  FAVOR_PARTY_A:'bg-green-500', FAVOR_PARTY_B:'bg-blue-500',
  INSUFFICIENT_EVIDENCE:'bg-yellow-500', CIRCUIT_BREAKER:'bg-red-500', NO_CONSENSUS:'bg-muted',
};

// ─── Step timeline ─────────────────────────────────────────────────────────

function StepTimeline({ current, ts }: { current: number; ts: Record<number, string> }) {
  return (
    <div className="card">
      <div className="section-title">Execution Log</div>
      <div className="space-y-0.5">
        {STEP_LABELS.map(({ label, icon }, i) => {
          const n = i + 1;
          const status = n < current ? 'done' : n === current ? 'running' : 'pending';
          return (
            <div key={i} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg transition-all ${
              status === 'running' ? 'bg-primary/5 border border-primary/20 step-active-glow' : ''
            }`}>
              <StepDot status={status} />
              <div className="min-w-0 flex-1">
                <div className={`font-body text-xs font-medium truncate ${
                  status === 'done' ? 'text-muted-foreground' : status === 'running' ? 'text-foreground' : 'text-muted-foreground/40'
                }`}>
                  <span className="mr-1 opacity-60">{icon}</span>{n}. {label}
                </div>
                {ts[n] && <div className="text-[10px] text-muted-foreground/40 mono">{ts[n]}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Model card ─────────────────────────────────────────────────────────────

function ModelCard({ m, revealed, animated }: { m: ModelVote; revealed: boolean; animated: boolean }) {
  const icons: Record<string, string> = {
    'claude-opus-4-6':'🤖', 'gpt-4o':'🧠', 'mistral-large-2411':'💡',
  };
  if (!revealed) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 opacity-40">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base opacity-50">{icons[m.id] ?? '🤖'}</span>
          <span className="font-body text-sm text-muted-foreground">{m.name}</span>
          <span className="ml-auto font-body text-xs text-muted-foreground/40">Pending…</span>
        </div>
        <div className="h-2 bg-secondary rounded animate-pulse" />
      </div>
    );
  }
  const isCB = m.vote === 'CIRCUIT_BREAKER';
  return (
    <div className={`bg-card border ${isCB ? 'border-red-800/60 circuit-flash' : 'border-border'} rounded-xl p-4 ${animated ? 'verdict-reveal' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{icons[m.id] ?? '🤖'}</span>
        <span className="font-body text-sm font-semibold text-foreground">{m.name}</span>
        {isCB && (
          <span className="ml-auto flex items-center gap-1 font-body text-xs text-red-400">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />API FAILED
          </span>
        )}
      </div>
      <div className={`inline-flex items-center border rounded-full px-3 py-0.5 font-body text-xs font-bold mb-3 ${VOTE_COLORS[m.vote]}`}>
        {m.vote.replace(/_/g,' ')}
      </div>
      {!isCB && (
        <div className="mb-3">
          <div className="font-body text-xs text-muted-foreground mb-1">Confidence</div>
          <ConfBar pct={m.confidence} cls={CONF_COLORS[m.vote]} />
        </div>
      )}
      <p className="font-body text-xs text-muted-foreground leading-relaxed italic">"{m.reasoning}"</p>
    </div>
  );
}

// ─── Step detail (center panel) ─────────────────────────────────────────────

function StepDetail({
  step, sc, revealed, phase,
}: { step: number; sc: Scenario; revealed: number; phase: 'idle'|'running'|'complete'; }) {

  const sigHex = '0x88f6e2f5f26b314595d6493be0368b9d51de032ae8fbb4afcf8c14ff234f3c46304ff48acf854d13865b13c503f3491a74907258b08e12ffba87217cba62e12f1c';

  if (phase === 'idle') {
    return (
      <div className="card-glow h-full flex flex-col items-center justify-center text-center gap-4 py-16">
        <div className="text-5xl">⚡</div>
        <div className="font-display text-xl font-bold text-gold-gradient">Ready to Run</div>
        <p className="font-body text-sm text-muted-foreground max-w-xs">
          Select a scenario and click <strong className="text-foreground">Launch Demo</strong> to watch the full dispute lifecycle unfold.
        </p>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="card h-full flex items-center justify-center gap-3 text-muted-foreground">
        <Spinner /><span className="font-body text-sm">Initializing…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {step >= 1 && (
        <div className="card fade-in">
          <div className="section-title">Step 1 — Dispute Created</div>
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-sm text-foreground font-medium">{sc.partyA.name} vs {sc.partyB.name}</span>
              <span className="badge badge-brand">PENDING</span>
            </div>
            <p className="font-body text-xs text-muted-foreground italic">"{sc.description}"</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-xs text-muted-foreground">Deposit:</span>
              <span className="font-body text-sm font-bold mono text-foreground">{sc.deposit} ETH each</span>
            </div>
            <div className="space-y-1">
              <div className="font-body text-xs text-muted-foreground">Dispute ID</div>
              <div className="flex items-center gap-2 flex-wrap">
                <Hash v={sc.disputeId} />
                <EthLink href={`${SEP}/address/${REGISTRY}`} label="View Registry" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="font-body text-xs text-muted-foreground">Parties</div>
              <div className="mono text-xs text-muted-foreground space-y-0.5">
                <div>A: <a href={`${SEP}/address/${sc.partyA.addr}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{sc.partyA.addr.slice(0,12)}…</a></div>
                <div>B: <a href={`${SEP}/address/${sc.partyB.addr}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{sc.partyB.addr.slice(0,12)}…</a></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step >= 2 && (
        <div className="card fade-in">
          <div className="section-title">Step 2 — Bob Deposits</div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-950/60 border border-green-800/60 flex items-center justify-center text-green-400 font-bold text-sm">✓</div>
            <div>
              <div className="font-body text-sm font-medium text-foreground">Deposit Matched — Dispute <span className="text-green-400">ACTIVE</span></div>
              <div className="font-body text-xs text-muted-foreground">Both parties locked {sc.deposit} ETH in escrow</div>
            </div>
          </div>
          <div className="mt-3 font-body text-xs text-muted-foreground">
            Total pool: <span className="text-foreground font-bold mono">{(parseFloat(sc.deposit)*2).toFixed(4)} ETH</span>
            <span className="mx-1">·</span>
            <EthLink href={`${SEP}/address/${ESCROW}`} label="View Escrow" />
          </div>
        </div>
      )}

      {step >= 3 && (
        <div className="card-tee fade-in">
          <div className="section-title">Step 3 — Evidence Submitted</div>
          <div className="space-y-3">
            {[
              { party:'PARTY A EVIDENCE', hash: sc.evidenceHashA, blur: 'Alice: Delivered all 5 screens on Jan 15. See attached Figma link and Loom recording.' },
              { party:'PARTY B EVIDENCE', hash: sc.evidenceHashB, blur: 'Bob: Screens were delivered but color palette doesn\'t match brand guide.' },
            ].map(({ party, hash, blur }) => (
              <div key={party} className="bg-background border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-body text-xs font-bold text-primary">{party}</span>
                  <span className="badge badge-brand text-[10px]">PRIVATE</span>
                </div>
                <div className="font-body text-xs text-muted-foreground mb-1">Content (encrypted — never on-chain):</div>
                <div className="font-body text-xs mono bg-secondary border border-border rounded p-2 text-muted-foreground blur-[3px] select-none">
                  {blur}
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="font-body text-[10px] text-muted-foreground">On-chain hash (PUBLIC):</span>
                  <Hash v={hash} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step >= 4 && (
        <div className="card fade-in">
          <div className="section-title">Step 4 — CRE Workflow Triggered</div>
          <div className="flex items-start gap-3">
            <span className="chainlink-tag mt-0.5">⚡ Chainlink CRE</span>
            <div className="space-y-1 font-body text-xs text-muted-foreground">
              <div>Trigger: <span className="text-foreground">Manual / Cron (*/5 * * * *)</span></div>
              <div>Workflow: <span className="mono text-foreground">dist/index.wasm</span></div>
              <div>Operator: <Hash v="0xd27673C4F38680C0968086Bb833eb876eeB65546" /></div>
              <div className="flex items-center gap-2 pt-1">
                <EthLink href={`${SEP}/address/${VERIFIER}`} label="CREVerifier on Etherscan" />
              </div>
            </div>
          </div>
        </div>
      )}

      {step >= 5 && (
        <div className="card-tee fade-in">
          <div className="section-title">Step 5 — Confidential HTTP (TEE)</div>
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-primary text-base">🛡️</div>
            <div>
              <div className="font-body text-sm font-semibold text-foreground">Trusted Execution Environment</div>
              <div className="font-body text-xs text-primary">Chainlink Confidential HTTP</div>
            </div>
          </div>
          <div className="space-y-1.5 font-body text-xs">
            {[
              '✓ Party A evidence fetched and decrypted',
              '✓ Party B evidence fetched and decrypted',
              '✓ keccak256(contentA) == evidenceHashA on-chain',
              '✓ keccak256(contentB) == evidenceHashB on-chain',
            ].map(l => (
              <div key={l} className="text-green-400 font-medium flex items-center gap-2">{l}</div>
            ))}
            <div className="text-destructive/80 font-medium border-t border-border pt-2 mt-2">
              ✗ Node operators: CANNOT read content<br/>
              ✗ Content: NEVER logged, NEVER stored publicly
            </div>
          </div>
        </div>
      )}

      {step >= 6 && (
        <div className="space-y-3 fade-in">
          <div className="section-title">Steps 6–8 — AI Model Votes</div>
          {sc.models.map((m, i) => (
            <ModelCard
              key={m.id}
              m={m}
              revealed={revealed > i}
              animated={revealed === i + 1 && step <= 8}
            />
          ))}
        </div>
      )}

      {step >= 9 && (
        <div className="card fade-in">
          <div className="section-title">Step 9 — Consensus + ECDSA Signature</div>
          <div className={`font-display text-lg font-bold mb-3 ${sc.outcomeCls}`}>{sc.finalOutcome}</div>
          <div className="font-body text-xs text-muted-foreground mb-4">
            {sc.models.filter(m => m.vote === sc.models[0].vote).length}/3 models in agreement
          </div>
          <div className="bg-background border border-border rounded-lg p-3 space-y-2">
            <div className="font-body text-xs text-muted-foreground font-semibold uppercase tracking-wider">ECDSA Signature (65 bytes)</div>
            <div className="mono text-[10px] text-muted-foreground break-all leading-relaxed">{sigHex}</div>
            <div className="font-body text-xs text-muted-foreground">
              <span className="text-foreground">ecrecover(verdictHash, sig)</span> →{' '}
              <span className="text-green-400 mono">0xd276…546</span>{' '}
              <span className="text-green-500">✓ matches creOperator</span>
            </div>
          </div>
          <div className="mt-3">
            <EthLink href={`${SEP}/address/${VERIFIER}`} label="Verify on Etherscan" />
          </div>
        </div>
      )}

      {step >= 10 && (
        <div className={`card border-2 fade-in ${sc.id === 'happy' ? 'border-green-800/60 bg-green-950/10' : 'border-red-800/60 bg-red-950/10'}`}>
          <div className="section-title">Step 10 — On-Chain Settlement</div>
          <div className={`font-display text-2xl font-bold mb-2 ${sc.outcomeCls}`}>
            {sc.id === 'happy' ? '🏆' : sc.id === 'circuit' ? '⚠️' : '↩️'} {sc.finalOutcome}
          </div>
          <p className="font-body text-sm text-muted-foreground mb-4">{sc.settlementNote}</p>
          <div className="grid grid-cols-2 gap-3">
            <EthLink href={`${SEP}/address/${ESCROW}`}   label="DisputeEscrow ↗" cls="text-sm" />
            <EthLink href={`${SEP}/address/${REGISTRY}`} label="Audit Trail ↗"   cls="text-sm" />
            <EthLink href={`${SEP}/address/${VERIFIER}`} label="CREVerifier ↗"   cls="text-sm" />
            <EthLink href={`${SEP}/tx/${sc.disputeId}`}  label="Dispute ID ↗"    cls="text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── What-If Explorer ─────────────────────────────────────────────────────────

const ALL_OUTCOMES: VerdictOutcome[] = ['FAVOR_PARTY_A','FAVOR_PARTY_B','INSUFFICIENT_EVIDENCE','CIRCUIT_BREAKER'];
const OUTCOME_LABELS: Record<VerdictOutcome, string> = {
  FAVOR_PARTY_A:'Party A wins', FAVOR_PARTY_B:'Party B wins',
  INSUFFICIENT_EVIDENCE:'Insufficient evidence', NO_CONSENSUS:'No consensus', CIRCUIT_BREAKER:'Circuit breaker',
};

function WhatIfExplorer({ sc }: { sc: Scenario }) {
  const defaultVotes = sc.models.map(m => ({ vote: m.vote, confidence: m.confidence }));
  const [votes, setVotes] = useState(defaultVotes);

  useEffect(() => { setVotes(sc.models.map(m => ({ vote: m.vote, confidence: m.confidence }))); }, [sc]);

  const result = useMemo(() => {
    const parsed: ParsedModelVerdict[] = votes.map((v, i) => ({
      modelId: sc.models[i].id,
      vote: v.vote,
      confidencePct: v.confidence,
      reasoning: '',
      parseSuccess: true,
    }));
    return applyConsensus(parsed);
  }, [votes, sc]);

  const outcomeCls =
    result.finalOutcome === 'FAVOR_PARTY_A' ? 'text-green-400' :
    result.finalOutcome === 'FAVOR_PARTY_B' ? 'text-blue-400' :
    result.finalOutcome === 'CIRCUIT_BREAKER' ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="card-glow mt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="text-2xl">🔬</div>
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">What-If Explorer</h2>
          <p className="font-body text-xs text-muted-foreground">Toggle any model's vote and see the consensus change in real time.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {sc.models.map((m, i) => {
          const icons: Record<string, string> = { 'claude-opus-4-6':'🤖','gpt-4o':'🧠','mistral-large-2411':'💡' };
          return (
            <div key={m.id} className="bg-background border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span>{icons[m.id] ?? '🤖'}</span>
                <span className="font-body text-sm font-semibold text-foreground">{m.name}</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label">Vote</label>
                  <select
                    value={votes[i].vote}
                    onChange={e => setVotes(v => { const n=[...v]; n[i]={...n[i],vote:e.target.value as VerdictOutcome}; return n; })}
                    className="input font-body text-sm"
                  >
                    {ALL_OUTCOMES.map(o => <option key={o} value={o}>{OUTCOME_LABELS[o]}</option>)}
                  </select>
                </div>
                {votes[i].vote !== 'CIRCUIT_BREAKER' && (
                  <div>
                    <label className="label">Confidence: <span className="text-foreground font-bold">{votes[i].confidence}%</span></label>
                    <input
                      type="range" min={1} max={99} value={votes[i].confidence}
                      onChange={e => setVotes(v => { const n=[...v]; n[i]={...n[i],confidence:+e.target.value}; return n; })}
                      className="w-full accent-primary h-1.5 mt-1"
                    />
                    <ConfBar pct={votes[i].confidence} cls={CONF_COLORS[votes[i].vote] ?? 'bg-primary'} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`rounded-xl border-2 p-5 transition-all ${
        result.finalOutcome === 'FAVOR_PARTY_A' ? 'border-green-800/60 bg-green-950/10' :
        result.finalOutcome === 'CIRCUIT_BREAKER' ? 'border-orange-800/60 bg-orange-950/10' :
        'border-red-800/60 bg-red-950/10'
      }`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-body text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Consensus Result</div>
            <div className={`font-display text-2xl font-bold ${outcomeCls}`}>
              {result.finalOutcome.replace(/_/g,' ')}
            </div>
            <div className="font-body text-xs text-muted-foreground mt-1">{result.reasoning}</div>
          </div>
          <div className="text-right space-y-1">
            <div className="font-body text-xs text-muted-foreground">Agreement</div>
            <div className="font-display text-3xl font-bold text-foreground">{result.consensusCount}<span className="text-muted-foreground text-lg">/3</span></div>
            {result.aggregateConfidenceBps > 0 && (
              <div className="font-body text-xs text-muted-foreground">Avg confidence: {(result.aggregateConfidenceBps/100).toFixed(0)}%</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main DemoPage ────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [scenario, setScenario] = useState<Scenario>(SCENARIOS[0]);
  const [phase,    setPhase]    = useState<'idle'|'running'|'complete'>('idle');
  const [step,     setStep]     = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [ts,       setTs]       = useState<Record<number, string>>({});
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setPhase('idle'); setStep(0); setRevealed(0); setTs({});
    setTimeout(() => { cancelRef.current = false; }, 50);
  }, []);

  const changeScenario = (sc: Scenario) => { reset(); setScenario(sc); };

  const launch = useCallback(async () => {
    cancelRef.current = false;
    setPhase('running'); setStep(0); setRevealed(0); setTs({});
    let modelReveal = 0;

    for (let i = 0; i < STEP_LABELS.length; i++) {
      const n = i + 1;
      await new Promise(r => setTimeout(r, DELAYS[i]));
      if (cancelRef.current) return;
      setStep(n);
      setTs(prev => ({ ...prev, [n]: new Date().toLocaleTimeString() }));
      if (n >= 6 && n <= 8) { modelReveal++; setRevealed(modelReveal); }
    }
    if (!cancelRef.current) setPhase('complete');
  }, []);

  const sc = scenario;

  return (
    <div className="min-h-screen bg-background">

      {/* Control bar */}
      <div className="border-b border-border bg-background/90 backdrop-blur sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="font-body text-sm font-semibold text-foreground mr-2">Scenario:</div>
          <div className="flex gap-1.5 flex-wrap">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => changeScenario(s)}
                disabled={phase === 'running'}
                className={`px-3 py-1.5 rounded-lg font-body text-xs font-semibold border transition-all ${
                  sc.id === s.id
                    ? s.id === 'happy'   ? 'bg-green-950  border-green-700  text-green-300'
                    : s.id === 'failure' ? 'bg-red-950    border-red-700    text-red-300'
                    :                      'bg-orange-950 border-orange-700 text-orange-300'
                    : 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground/40'
                }`}
              >
                {s.label}
                <span className="ml-1.5 font-body text-[9px] opacity-70">{s.tagline}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {phase === 'complete' && (
              <span className={`font-body text-sm font-bold ${sc.outcomeCls}`}>{sc.finalOutcome}</span>
            )}
            {phase === 'running' && (
              <span className="flex items-center gap-2 font-body text-sm text-primary">
                <Spinner /> Step {step}/{STEP_LABELS.length}
              </span>
            )}
            {phase !== 'idle' && (
              <button onClick={reset} className="btn-ghost font-body text-sm">Reset</button>
            )}
            <button
              onClick={launch}
              disabled={phase === 'running'}
              className="glow-gold inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 font-body text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {phase === 'running' ? (
                <><Spinner />Running…</>
              ) : phase === 'complete' ? (
                '▶ Run Again'
              ) : (
                '▶ Launch Demo'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-5">

          {/* Left: Timeline + Chainlink info */}
          <div className="col-span-12 lg:col-span-3">
            <StepTimeline current={step} ts={ts} />

            <div className="card mt-4 space-y-3">
              <div className="section-title">Chainlink Services</div>
              {[
                { tag:'CRE',               desc:'Verifiable compute' },
                { tag:'Confidential HTTP', desc:'TEE evidence fetch' },
                { tag:'Operator Key',      desc:'ECDSA signing' },
              ].map(({ tag, desc }) => (
                <div key={tag} className="flex items-center gap-2">
                  <span className="chainlink-tag font-body text-[10px]">⚡ {tag}</span>
                  <span className="font-body text-xs text-muted-foreground">{desc}</span>
                </div>
              ))}
              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="section-title">Contracts</div>
                {([['Escrow',ESCROW],['Registry',REGISTRY],['Verifier',VERIFIER]] as [string,string][]).map(([l,a])=>(
                  <EthLink key={l} href={`${SEP}/address/${a}`} label={l} cls="block" />
                ))}
              </div>
            </div>
          </div>

          {/* Center: Step detail */}
          <div className="col-span-12 lg:col-span-5">
            <StepDetail step={step} sc={sc} revealed={revealed} phase={phase} />
          </div>

          {/* Right: Privacy + consensus */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            <div className="card-tee">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🔐</span>
                <div>
                  <div className="font-body text-sm font-bold text-foreground">Evidence Privacy</div>
                  <div className="font-body text-xs text-primary">Chainlink Confidential HTTP</div>
                </div>
              </div>
              <div className="space-y-2 font-body text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-background border border-border rounded-lg p-2.5">
                    <div className="text-muted-foreground mb-1">PRIVATE (TEE only)</div>
                    <div className="text-primary font-medium">Evidence Content</div>
                    <div className="text-muted-foreground/60 mt-1">Never logged · Never public</div>
                  </div>
                  <div className="bg-background border border-border rounded-lg p-2.5">
                    <div className="text-muted-foreground mb-1">PUBLIC (on-chain)</div>
                    <div className="text-green-400 font-medium">keccak256(content)</div>
                    <div className="text-muted-foreground/60 mt-1">Immutable · Verifiable</div>
                  </div>
                </div>
                {step >= 5 && (
                  <div className="border-t border-border pt-2 text-green-400 fade-in">
                    ✓ Integrity verified: hash matches on-chain commitment
                  </div>
                )}
              </div>
            </div>

            {step >= 6 && (
              <div className="card fade-in">
                <div className="section-title">Votes Revealed ({revealed}/3)</div>
                <div className="space-y-2">
                  {sc.models.map((m, i) => (
                    <div key={m.id} className={`flex items-center gap-2 font-body text-xs transition-opacity ${revealed > i ? 'opacity-100' : 'opacity-25'}`}>
                      <div className={`inline-flex border rounded-full px-2 py-0.5 text-[10px] font-semibold ${VOTE_COLORS[m.vote]}`}>
                        {m.vote.replace(/_/g,' ')}
                      </div>
                      <span className="text-muted-foreground">{m.name}</span>
                      {revealed > i && !m.failed && <span className="ml-auto text-muted-foreground mono">{m.confidence}%</span>}
                    </div>
                  ))}
                </div>
                {step >= 9 && (
                  <div className={`mt-3 border-t border-border pt-3 font-display text-sm font-bold fade-in ${sc.outcomeCls}`}>
                    {sc.finalOutcome}
                  </div>
                )}
              </div>
            )}

            {step >= 10 && (
              <div className="card fade-in">
                <div className="section-title">On-Chain Proof</div>
                <div className="space-y-2 font-body text-xs text-muted-foreground">
                  <div>Dispute ID:</div>
                  <Hash v={sc.disputeId} />
                  <div className="flex gap-3 flex-wrap pt-1">
                    <EthLink href={`${SEP}/address/${REGISTRY}`} label="Audit Trail" />
                    <EthLink href={`${SEP}/address/${VERIFIER}`} label="ECDSA Proof" />
                    <EthLink href={`${SEP}/address/${ESCROW}`}   label="Settlement" />
                  </div>
                  <div className="border-t border-border pt-2 text-[10px] text-muted-foreground/60">
                    All disputes and verdicts recorded permanently. Immutable audit trail.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <WhatIfExplorer sc={sc} />
      </div>
    </div>
  );
}
