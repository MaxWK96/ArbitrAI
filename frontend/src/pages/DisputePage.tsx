import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Contract, formatEther } from 'ethers';
import { ADDRESSES, ESCROW_ABI, REGISTRY_ABI, DISPUTE_STATUS, VERDICT_OUTCOME } from '../lib/contracts.ts';
import { submitEvidence } from '../lib/evidence.ts';
import type { WalletState } from '../lib/wallet.ts';

interface Props { wallet: WalletState | null; }

const SEP = 'https://sepolia.etherscan.io';

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  NONE:           { label:'Not Found',       cls:'badge-gray',   icon:'?' },
  PENDING:        { label:'Pending',         cls:'badge-yellow', icon:'⏳' },
  ACTIVE:         { label:'Active',          cls:'badge-brand',  icon:'🟢' },
  IN_ARBITRATION: { label:'In Arbitration',  cls:'badge-blue',   icon:'⚡' },
  SETTLED:        { label:'Settled',         cls:'badge-green',  icon:'✅' },
  REFUNDED:       { label:'Refunded',        cls:'badge-red',    icon:'↩️' },
  ESCALATED:      { label:'Escalated',       cls:'badge-orange', icon:'⚠️' },
};

function EthLink({ href, short, full }: { href: string; short: string; full?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" title={full}
       className="inline-flex items-center gap-1 font-mono text-xs text-brand-400 hover:text-brand-300 transition-colors">
      {short}
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
      </svg>
    </a>
  );
}

function ConfBar({ pct, cls = 'bg-brand-500' }: { pct: number; cls?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${cls}`} style={{ width:`${pct}%` }} />
      </div>
      <span className="text-xs mono text-white w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function DisputePage({ wallet }: Props) {
  const { id: disputeId } = useParams<{ id: string }>();
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [dispute,   setDispute]   = useState<Record<string, any> | null>(null);
  const [escrow,    setEscrow]    = useState<Record<string, any> | null>(null);
  const [evidence,  setEvidence]  = useState('');
  const [submEvid,  setSubmEvid]  = useState(false);
  const [evidResult,setEvidResult] = useState<{ hash: string } | null>(null);
  const [evidError, setEvidError] = useState('');

  useEffect(() => {
    if (!disputeId || !wallet) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const prov = wallet.provider;
        const reg = new Contract(ADDRESSES.registry, REGISTRY_ABI, prov);
        const esc = new Contract(ADDRESSES.escrow,   ESCROW_ABI,   prov);
        const [d, e] = await Promise.all([
          reg.getDispute(disputeId),
          esc.getEscrow(disputeId),
        ]);
        setDispute({
          id:          d[0],
          partyA:      d[1],
          partyB:      d[2],
          amount:      d[3],
          status:      d[4],
          evidenceHashA: d[5],
          evidenceHashB: d[6],
          workflowOutputHash: d[7],
          createdAt:   d[8],
          settledAt:   d[9],
          winner:      d[10],
          description: d[11],
        });
        setEscrow({
          depositA:  e[0],
          depositB:  e[1],
          settledB:  e[4],
          settled:   e[5],
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dispute');
      } finally {
        setLoading(false);
      }
    })();
  }, [disputeId, wallet]);

  const handleSubmitEvidence = async () => {
    if (!wallet || !disputeId || !evidence.trim()) return;
    setSubmEvid(true); setEvidError('');
    try {
      // Determine party label from wallet address
      const partyLabel = dispute?.partyA?.toString().toLowerCase() === wallet.address.toLowerCase() ? 'a' : 'b';
      const res = await submitEvidence(disputeId, partyLabel as 'a'|'b', evidence, wallet.address);
      setEvidResult({ hash: res.contentHash });
      setEvidence('');
    } catch (e) {
      setEvidError(e instanceof Error ? e.message : 'Evidence submission failed');
    } finally {
      setSubmEvid(false);
    }
  };

  if (!wallet) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="text-4xl">🔒</div>
        <h2 className="text-xl font-bold text-white">Connect Wallet to View Dispute</h2>
        <p className="text-gray-500 text-sm">A connected wallet is required to read on-chain dispute data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Loading dispute from Sepolia…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-white">Failed to load</h2>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!dispute) return null;

  const statusKey  = DISPUTE_STATUS[Number(dispute.status)] ?? 'NONE';
  const statusConf = STATUS_CONFIG[statusKey] ?? STATUS_CONFIG.NONE;
  const createdTs  = dispute.createdAt ? new Date(Number(dispute.createdAt) * 1000).toLocaleString() : '—';
  const settledTs  = dispute.settledAt && Number(dispute.settledAt) > 0
                      ? new Date(Number(dispute.settledAt) * 1000).toLocaleString() : null;
  const hasEvidA   = dispute.evidenceHashA != null && String(dispute.evidenceHashA) !== '0x0000000000000000000000000000000000000000000000000000000000000000';
  const hasEvidB   = dispute.evidenceHashB != null && String(dispute.evidenceHashB) !== '0x0000000000000000000000000000000000000000000000000000000000000000';
  const isParty    = wallet.address.toLowerCase() === dispute.partyA?.toString().toLowerCase()
                  || wallet.address.toLowerCase() === dispute.partyB?.toString().toLowerCase();
  const canEvidence = statusKey === 'ACTIVE' && isParty;
  const isSettled  = statusKey === 'SETTLED' || statusKey === 'REFUNDED';

  // Pre-typed party data to avoid `unknown` in JSX
  const partyAddrA: string  = String(dispute.partyA);
  const partyAddrB: string  = String(dispute.partyB);
  const depositA:   string  = escrow?.depositA != null ? formatEther(String(escrow.depositA)) : '—';
  const depositB:   string  = escrow?.depositB != null ? formatEther(String(escrow.depositB)) : '—';

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispute</h1>
          <div className="font-mono text-xs text-gray-500 mt-1 break-all">{disputeId}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${statusConf.cls} text-sm px-3 py-1`}>
            {statusConf.icon} {statusConf.label}
          </span>
          <EthLink
            href={`${SEP}/address/${ADDRESSES.registry}`}
            short="Registry ↗"
            full={ADDRESSES.registry}
          />
        </div>
      </div>

      {/* ── Description ── */}
      <div className="card">
        <div className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wider">Description</div>
        <p className="text-sm text-gray-300 leading-relaxed italic">"{String(dispute.description)}"</p>
        <div className="text-xs text-gray-600 mt-2">Created: {createdTs}</div>
        {settledTs && <div className="text-xs text-gray-600">Settled: {settledTs}</div>}
      </div>

      {/* ── Parties + Deposits ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { label:'Party A',  addr: partyAddrA, deposit: depositA },
          { label:'Party B',  addr: partyAddrB, deposit: depositB },
        ].map(({ label, addr, deposit }) => (
          <div key={label} className="card space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{label}</span>
              {addr.toLowerCase() === wallet.address.toLowerCase() && (
                <span className="badge badge-brand text-[10px]">You</span>
              )}
            </div>
            <EthLink href={`${SEP}/address/${addr}`} short={`${addr.slice(0,8)}…${addr.slice(-6)}`} full={addr} />
            <div className="text-sm font-bold mono text-white">{deposit} ETH locked</div>
          </div>
        ))}
      </div>

      {/* ── Evidence ── */}
      <div className="card space-y-4">
        <div className="section-title">Evidence Hashes (on-chain)</div>
        <div className="space-y-2 text-xs">
          {[
            { label:'Party A', hash: String(dispute.evidenceHashA), ok: hasEvidA },
            { label:'Party B', hash: String(dispute.evidenceHashB), ok: hasEvidB },
          ].map(({ label, hash, ok }) => (
            <div key={label} className="flex items-center gap-3 flex-wrap">
              <span className="text-gray-500 w-16">{label}:</span>
              {ok ? (
                <>
                  <span className="mono text-green-400">{hash.slice(0,12)}…{hash.slice(-8)}</span>
                  <span className="badge badge-green text-[10px]">Submitted</span>
                </>
              ) : (
                <span className="text-gray-700 italic">Not yet submitted</span>
              )}
            </div>
          ))}
        </div>
        {(hasEvidA || hasEvidB) && (
          <div className="card-tee text-xs text-purple-400 flex items-center gap-2">
            🔐 Hashes verified — content fetched privately via Chainlink Confidential HTTP
          </div>
        )}
      </div>

      {/* ── Evidence Submission ── */}
      {canEvidence && (
        <div className="card space-y-4">
          <div className="section-title">Submit Your Evidence</div>
          <div className="card-tee text-xs text-gray-400 space-y-1">
            <div className="flex items-center gap-1.5 text-purple-300 font-medium mb-1">
              🔐 Confidential HTTP — your evidence stays private
            </div>
            Content is encrypted at rest. The CRE workflow fetches it inside a Trusted Execution Environment.
            Only keccak256(content) is committed on-chain — node operators never read it.
          </div>
          <textarea
            className="input h-28 resize-none"
            placeholder="Describe your position clearly. Include dates, deliverables, references, and links to supporting documentation…"
            value={evidence}
            onChange={e => setEvidence(e.target.value)}
          />
          {evidError && <p className="text-xs text-red-400">{evidError}</p>}
          {evidResult && (
            <div className="bg-green-950/40 border border-green-800/60 rounded-lg p-3 space-y-1">
              <div className="text-green-400 text-sm font-semibold">✓ Evidence submitted privately</div>
              <div className="text-xs text-gray-500">On-chain hash: <span className="mono text-gray-300">{evidResult.hash}</span></div>
              <div className="text-xs text-gray-600">Now call submitEvidence() on-chain with this hash.</div>
            </div>
          )}
          <button
            onClick={handleSubmitEvidence}
            disabled={submEvid || !evidence.trim()}
            className="btn-primary"
          >
            {submEvid ? 'Submitting…' : 'Submit Evidence Privately'}
          </button>
        </div>
      )}

      {/* ── Workflow Output / Settlement ── */}
      {dispute.workflowOutputHash && dispute.workflowOutputHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
        <div className={`card border-2 ${statusKey === 'SETTLED' ? 'border-green-800/60 bg-green-950/10' : 'border-red-800/60 bg-red-950/10'}`}>
          <div className="section-title">CRE Verdict</div>
          <div className={`text-xl font-extrabold mb-3 ${statusKey === 'SETTLED' ? 'text-green-400' : 'text-red-400'}`}>
            {statusKey === 'SETTLED' ? '🏆 Settled' : '↩️ Refunded'}
          </div>
          {dispute.winner != null && String(dispute.winner) !== '0x0000000000000000000000000000000000000000' && (
            <div className="text-sm text-gray-400 mb-2">
              Winner: <EthLink href={`${SEP}/address/${String(dispute.winner)}`} short={`${String(dispute.winner).slice(0,8)}…`} full={String(dispute.winner)} />
            </div>
          )}
          {escrow?.depositA != null && escrow?.depositB != null && statusKey === 'SETTLED' && (
            <div className="text-sm text-gray-400 mb-3">
              Payout: <span className="text-white font-bold mono">
                {(parseFloat(formatEther(String(escrow.depositA))) + parseFloat(formatEther(String(escrow.depositB))) * 0.99).toFixed(4)} ETH
              </span> (1% fee deducted)
            </div>
          )}
          <div className="text-xs text-gray-600 mb-3">
            Workflow proof hash: <span className="mono text-gray-400">{String(dispute.workflowOutputHash).slice(0,16)}…</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <EthLink href={`${SEP}/address/${ADDRESSES.escrow}`}   short="DisputeEscrow ↗" full={ADDRESSES.escrow} />
            <EthLink href={`${SEP}/address/${ADDRESSES.registry}`} short="Audit Trail ↗"   full={ADDRESSES.registry} />
            <EthLink href={`${SEP}/address/${ADDRESSES.verifier}`} short="CREVerifier ↗"   full={ADDRESSES.verifier} />
          </div>
        </div>
      )}

      {/* ── In Arbitration status ── */}
      {statusKey === 'IN_ARBITRATION' && (
        <div className="card-glow flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-brand-300">CRE Workflow Running</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Chainlink CRE is querying Claude, GPT-4o, and Mistral. Verdict will be submitted on-chain when 2/3 models agree.
            </div>
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="card-sm flex flex-wrap gap-4 justify-between items-center">
        <span className="text-xs text-gray-600">Contracts</span>
        <div className="flex gap-4 flex-wrap">
          <EthLink href={`${SEP}/address/${ADDRESSES.escrow}`}   short="DisputeEscrow" full={ADDRESSES.escrow} />
          <EthLink href={`${SEP}/address/${ADDRESSES.registry}`} short="Registry"      full={ADDRESSES.registry} />
          <EthLink href={`${SEP}/address/${ADDRESSES.verifier}`} short="CREVerifier"   full={ADDRESSES.verifier} />
        </div>
      </div>
    </div>
  );
}
