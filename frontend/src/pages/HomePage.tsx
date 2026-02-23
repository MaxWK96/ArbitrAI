import { Link } from 'react-router-dom';
import type { WalletState } from '../lib/wallet.ts';

const ESCROW   = '0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7';
const REGISTRY = '0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5';
const VERIFIER = '0x18b34E31290Ac10dE263943cD9D617EE1f570133';
const SEP      = 'https://sepolia.etherscan.io/address/';

interface Props { wallet: WalletState | null; }

const STEPS = [
  { n:'01', icon:'🔐', title:'Lock ETH in Escrow',           desc:'Both parties deposit equal ETH into a trustless smart contract. No admin can touch it — only CRE can release it.' },
  { n:'02', icon:'🕵️', title:'Submit Evidence Privately',     desc:'Evidence is encrypted and sent to the ArbitrAI server. Only keccak256(content) is committed on-chain. The CRE workflow fetches it via Confidential HTTP inside a TEE.' },
  { n:'03', icon:'⚡', title:'CRE Orchestrates AI Consensus', desc:'Chainlink CRE queries Claude Opus 4.6, GPT-4o, and Mistral Large in parallel. Each model independently analyzes evidence and votes. 2/3 must agree.' },
  { n:'04', icon:'✅', title:'ECDSA-Signed Settlement',        desc:'The CRE operator key signs the WorkflowVerdict struct. CREVerifier.sol checks the signature on-chain, then calls executeVerdict() — transferring funds atomically.' },
];

const TRACKS = [
  { label:'CRE & AI',         color:'border-blue-800/50 bg-blue-950/20',   icon:'⚡', title:'Chainlink CRE',         desc:'CRE is the ONLY path to fund release. No admin override, no manual fallback. If CRE doesn\'t run, funds remain locked forever.' },
  { label:'Privacy',          color:'border-purple-800/50 bg-purple-950/20', icon:'🔒', title:'Confidential HTTP',      desc:'Evidence fetched inside Chainlink TEE. Node operators never see dispute content. Integrity verified by matching on-chain keccak256 hash.' },
  { label:'Risk & Compliance', color:'border-amber-800/50 bg-amber-950/20',  icon:'🛡️', title:'Circuit Breaker',        desc:'Any model failure triggers automatic full refund — no fee. Immutable audit trail of every vote, timestamp, and reasoning hash on-chain.' },
  { label:'AI Agents',        color:'border-emerald-800/50 bg-emerald-950/20', icon:'🤝', title:'Multi-Model Consensus',  desc:'3 independent AI arbitrators. No single model controls outcome. Confidence scores and reasoning hashes committed on-chain permanently.' },
];

const STATS = [
  { val:'3',    unit:'AI Models',      sub:'Claude · GPT-4o · Mistral'      },
  { val:'2/3',  unit:'Consensus',      sub:'required for settlement'         },
  { val:'100%', unit:'Refund on fail', sub:'no fee when circuit breaks'      },
  { val:'1%',   unit:'Protocol fee',   sub:'only on successful settlement'   },
];

export default function HomePage({ wallet }: Props) {
  return (
    <div className="min-h-screen dot-grid">
      <div className="max-w-6xl mx-auto px-4 py-16 space-y-28">

        {/* ── Hero ───────────────────────────────────────────── */}
        <section className="text-center space-y-7 pt-4">
          <div className="inline-flex items-center gap-2 bg-brand-950/60 border border-brand-800/50 text-brand-300 rounded-full px-4 py-1.5 text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
            Chainlink Convergence Hackathon 2026
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.08]">
            AI-Powered
            <span className="block gradient-text mt-1">Dispute Resolution</span>
          </h1>

          <p className="text-lg text-gray-400 max-w-xl mx-auto leading-relaxed">
            Three independent AI models reach cryptographic consensus inside Chainlink CRE.
            Evidence stays private. Every verdict is signed and verifiable on-chain.
            No human arbitrator. No admin key.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/demo" className="btn-primary text-base px-8 py-3 flex items-center gap-2 justify-center">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Watch Live Demo
            </Link>
            <Link to="/create" className="btn-secondary text-base px-8 py-3">
              Create a Dispute
            </Link>
          </div>

          {wallet && (
            <p className="text-sm text-green-400 mono">✓ {wallet.address.slice(0,8)}...{wallet.address.slice(-6)}</p>
          )}

          {/* Live contract badges */}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {([['DisputeEscrow', ESCROW], ['ArbitrationRegistry', REGISTRY], ['CREVerifier', VERIFIER]] as [string,string][]).map(([label, addr]) => (
              <a key={label}
                 href={`${SEP}${addr}`} target="_blank" rel="noreferrer"
                 className="chainlink-tag hover:border-blue-600/70 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {label}
                <span className="text-gray-600 font-mono">{addr.slice(0,6)}…{addr.slice(-4)}</span>
                <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            ))}
          </div>
        </section>

        {/* ── Stats ──────────────────────────────────────────── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(s => (
            <div key={s.unit} className="card text-center space-y-1">
              <div className="text-3xl font-extrabold gradient-text">{s.val}</div>
              <div className="text-sm font-semibold text-gray-200">{s.unit}</div>
              <div className="text-xs text-gray-500">{s.sub}</div>
            </div>
          ))}
        </section>

        {/* ── How it works ───────────────────────────────────── */}
        <section className="space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="text-gray-500">Every step is verifiable on-chain</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {STEPS.map(step => (
              <div key={step.n} className="card flex gap-4 hover:border-gray-700 transition-colors group">
                <div className="text-3xl flex-shrink-0 mt-0.5">{step.icon}</div>
                <div>
                  <div className="text-xs mono text-gray-600 mb-1 font-semibold">STEP {step.n}</div>
                  <h3 className="font-semibold text-white mb-2 group-hover:text-brand-300 transition-colors">{step.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Prize Tracks ───────────────────────────────────── */}
        <section className="space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">Built for Every Prize Track</h2>
            <p className="text-gray-500">Each feature maps to a specific Chainlink capability</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {TRACKS.map(t => (
              <div key={t.title} className={`rounded-xl border p-5 transition-colors hover:brightness-110 ${t.color}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{t.icon}</span>
                    <h3 className="font-semibold text-white">{t.title}</h3>
                  </div>
                  <span className="badge badge-gray text-xs">{t.label}</span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Architecture ───────────────────────────────────── */}
        <section className="card-glow space-y-5">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold">System Architecture</h2>
            <span className="badge badge-green">Live on Sepolia</span>
          </div>
          <div className="mono text-sm space-y-0.5 leading-7 overflow-x-auto">
            {[
              { c:'text-gray-400', i:0,  t:'Alice/Bob  →  DisputeEscrow.createDispute()  [ETH locked]' },
              { c:'text-gray-500', i:1,  t:'         →  ArbitrationRegistry.registerDispute()' },
              { c:'text-gray-500', i:1,  t:'         →  Evidence Server  [AES-256-GCM encrypted]' },
              { c:'text-brand-400',i:0,  t:'Chainlink CRE Workflow:' },
              { c:'text-brand-300',i:1,  t:'  [1] eth_call  →  read dispute from chain' },
              { c:'text-purple-400',i:1, t:'  [2] Confidential HTTP  →  fetch evidence (TEE)' },
              { c:'text-emerald-400',i:1,t:'  [3] Claude + GPT-4o + Mistral  →  parallel AI calls' },
              { c:'text-brand-300',i:1,  t:'  [4] applyConsensus(votes)  →  2/3 threshold' },
              { c:'text-yellow-400',i:1, t:'  [5] secp256k1.sign(verdictHash, operatorKey)' },
              { c:'text-brand-300',i:1,  t:'  [6] CREVerifier.submitVerdict(verdict, sig)' },
              { c:'text-gray-400', i:0,  t:'CREVerifier.sol:' },
              { c:'text-gray-400', i:1,  t:'  ecrecover(hash, sig) == operatorAddress  ✓' },
              { c:'text-gray-400', i:1,  t:'  evidenceHash integrity check             ✓' },
              { c:'text-gray-400', i:1,  t:'  staleness < 1 hour                       ✓' },
              { c:'text-gray-400', i:1,  t:'  DisputeEscrow.executeVerdict(winner)     →  ETH released' },
            ].map((row, i) => (
              <div key={i} className={`${row.c} ${row.i ? 'pl-4' : ''}`}>{row.t}</div>
            ))}
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────── */}
        <section className="text-center space-y-4 pb-8">
          <h2 className="text-2xl font-bold">See It Run End-to-End</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Click one button and watch the full dispute lifecycle — including the circuit breaker — unfold in real time.
          </p>
          <Link to="/demo" className="btn-primary text-base px-10 py-3 inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Launch Interactive Demo
          </Link>
        </section>

      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800/60 py-6">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
          <span>ArbitrAI — Chainlink Convergence Hackathon 2026</span>
          <div className="flex gap-4">
            <a href={`${SEP}${ESCROW}`}   target="_blank" rel="noreferrer" className="hover:text-brand-400 transition-colors">DisputeEscrow</a>
            <a href={`${SEP}${REGISTRY}`} target="_blank" rel="noreferrer" className="hover:text-brand-400 transition-colors">Registry</a>
            <a href={`${SEP}${VERIFIER}`} target="_blank" rel="noreferrer" className="hover:text-brand-400 transition-colors">CREVerifier</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
