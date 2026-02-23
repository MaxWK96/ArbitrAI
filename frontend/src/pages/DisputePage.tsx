import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Contract, formatEther } from 'ethers';
import { ExternalLink, Lock, Zap, Loader2 } from 'lucide-react';
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
       className="inline-flex items-center gap-1 mono font-body text-xs text-primary hover:text-primary/80 transition-colors">
      {short}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function ConfBar({ pct, cls = 'bg-primary' }: { pct: number; cls?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${cls}`} style={{ width:`${pct}%` }} />
      </div>
      <span className="font-body text-xs mono text-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

// ConfBar is imported but not directly used in the JSX below — kept for potential future use.
void ConfBar;

export default function DisputePage({ wallet }: Props) {
  const { id: disputeId } = useParams<{ id: string }>();
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [dispute,    setDispute]    = useState<Record<string, any> | null>(null);
  const [escrow,     setEscrow]     = useState<Record<string, any> | null>(null);
  const [evidence,   setEvidence]   = useState('');
  const [submEvid,   setSubmEvid]   = useState(false);
  const [evidResult, setEvidResult] = useState<{ hash: string } | null>(null);
  const [evidError,  setEvidError]  = useState('');

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
          id: d[0], partyA: d[1], partyB: d[2], amount: d[3], status: d[4],
          evidenceHashA: d[5], evidenceHashB: d[6], workflowOutputHash: d[7],
          createdAt: d[8], settledAt: d[9], winner: d[10], description: d[11],
        });
        setEscrow({ depositA: e[0], depositB: e[1], settledB: e[4], settled: e[5] });
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
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-secondary border border-border mx-auto">
          <Lock className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="font-display text-xl font-bold text-foreground">Connect Wallet to View Dispute</h2>
        <p className="font-body text-sm text-muted-foreground">A connected wallet is required to read on-chain dispute data.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
        <p className="font-body text-sm text-muted-foreground">Loading dispute from Sepolia…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="font-display text-xl font-bold text-foreground">Failed to load</h2>
        <p className="font-body text-sm text-destructive">{error}</p>
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

  const partyAddrA: string = String(dispute.partyA);
  const partyAddrB: string = String(dispute.partyB);
  const depositA:   string = escrow?.depositA != null ? formatEther(String(escrow.depositA)) : '—';
  const depositB:   string = escrow?.depositB != null ? formatEther(String(escrow.depositB)) : '—';

  // suppress unused warning
  void isSettled; void VERDICT_OUTCOME;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.25em] text-primary mb-1">Dispute</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Arbitration</h1>
          <div className="mono font-body text-xs text-muted-foreground mt-1 break-all">{disputeId}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${statusConf.cls} text-sm px-3 py-1`}>
            {statusConf.icon} {statusConf.label}
          </span>
          <EthLink href={`${SEP}/address/${ADDRESSES.registry}`} short="Registry ↗" full={ADDRESSES.registry} />
        </div>
      </div>

      {/* Description */}
      <div className="card">
        <div className="section-title">Description</div>
        <p className="font-body text-sm text-muted-foreground leading-relaxed italic">"{String(dispute.description)}"</p>
        <div className="font-body text-xs text-muted-foreground/60 mt-2">Created: {createdTs}</div>
        {settledTs && <div className="font-body text-xs text-muted-foreground/60">Settled: {settledTs}</div>}
      </div>

      {/* Parties + Deposits */}
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { label:'Party A', addr: partyAddrA, deposit: depositA },
          { label:'Party B', addr: partyAddrB, deposit: depositB },
        ].map(({ label, addr, deposit }) => (
          <div key={label} className="card space-y-2">
            <div className="flex items-center justify-between">
              <span className="section-title mb-0">{label}</span>
              {addr.toLowerCase() === wallet.address.toLowerCase() && (
                <span className="badge badge-brand text-[10px]">You</span>
              )}
            </div>
            <EthLink href={`${SEP}/address/${addr}`} short={`${addr.slice(0,8)}…${addr.slice(-6)}`} full={addr} />
            <div className="font-body text-sm font-bold mono text-foreground">{deposit} ETH locked</div>
          </div>
        ))}
      </div>

      {/* Evidence hashes */}
      <div className="card space-y-4">
        <div className="section-title">Evidence Hashes (on-chain)</div>
        <div className="space-y-2 font-body text-xs">
          {[
            { label:'Party A', hash: String(dispute.evidenceHashA), ok: hasEvidA },
            { label:'Party B', hash: String(dispute.evidenceHashB), ok: hasEvidB },
          ].map(({ label, hash, ok }) => (
            <div key={label} className="flex items-center gap-3 flex-wrap">
              <span className="text-muted-foreground w-16">{label}:</span>
              {ok ? (
                <>
                  <span className="mono text-green-400">{hash.slice(0,12)}…{hash.slice(-8)}</span>
                  <span className="badge badge-green text-[10px]">Submitted</span>
                </>
              ) : (
                <span className="text-muted-foreground/40 italic">Not yet submitted</span>
              )}
            </div>
          ))}
        </div>
        {(hasEvidA || hasEvidB) && (
          <div className="card-tee font-body text-xs text-primary flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            Hashes verified — content fetched privately via Chainlink Confidential HTTP
          </div>
        )}
      </div>

      {/* Evidence submission */}
      {canEvidence && (
        <div className="card space-y-4">
          <div className="section-title">Submit Your Evidence</div>
          <div className="card-tee font-body text-xs text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 text-primary font-medium mb-1">
              <Lock className="h-3.5 w-3.5" />
              Confidential HTTP — your evidence stays private
            </div>
            Content is encrypted at rest. The CRE workflow fetches it inside a Trusted Execution Environment.
            Only keccak256(content) is committed on-chain — node operators never read it.
          </div>
          <textarea
            className="input h-28 resize-none font-body"
            placeholder="Describe your position clearly. Include dates, deliverables, references, and links to supporting documentation…"
            value={evidence}
            onChange={e => setEvidence(e.target.value)}
          />
          {evidError && <p className="font-body text-xs text-destructive">{evidError}</p>}
          {evidResult && (
            <div className="bg-green-950/20 border border-green-800/40 rounded-lg p-3 space-y-1">
              <div className="font-body text-green-400 text-sm font-semibold">✓ Evidence submitted privately</div>
              <div className="font-body text-xs text-muted-foreground">On-chain hash: <span className="mono text-foreground">{evidResult.hash}</span></div>
              <div className="font-body text-xs text-muted-foreground/60">Now call submitEvidence() on-chain with this hash.</div>
            </div>
          )}
          <button onClick={handleSubmitEvidence} disabled={submEvid || !evidence.trim()} className="btn-primary">
            {submEvid ? 'Submitting…' : 'Submit Evidence Privately'}
          </button>
        </div>
      )}

      {/* Workflow output / verdict */}
      {dispute.workflowOutputHash && dispute.workflowOutputHash !== '0x0000000000000000000000000000000000000000000000000000000000000000' && (
        <div className={`card border-2 ${statusKey === 'SETTLED' ? 'border-green-800/60 bg-green-950/10' : 'border-red-800/60 bg-red-950/10'}`}>
          <div className="section-title">CRE Verdict</div>
          <div className={`font-display text-xl font-bold mb-3 ${statusKey === 'SETTLED' ? 'text-green-400' : 'text-red-400'}`}>
            {statusKey === 'SETTLED' ? '🏆 Settled' : '↩️ Refunded'}
          </div>
          {dispute.winner != null && String(dispute.winner) !== '0x0000000000000000000000000000000000000000' && (
            <div className="font-body text-sm text-muted-foreground mb-2">
              Winner: <EthLink href={`${SEP}/address/${String(dispute.winner)}`} short={`${String(dispute.winner).slice(0,8)}…`} full={String(dispute.winner)} />
            </div>
          )}
          {escrow?.depositA != null && escrow?.depositB != null && statusKey === 'SETTLED' && (
            <div className="font-body text-sm text-muted-foreground mb-3">
              Payout: <span className="text-foreground font-bold mono">
                {(parseFloat(formatEther(String(escrow.depositA))) + parseFloat(formatEther(String(escrow.depositB))) * 0.99).toFixed(4)} ETH
              </span> (1% fee deducted)
            </div>
          )}
          <div className="font-body text-xs text-muted-foreground/60 mb-3">
            Workflow proof hash: <span className="mono text-muted-foreground">{String(dispute.workflowOutputHash).slice(0,16)}…</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            <EthLink href={`${SEP}/address/${ADDRESSES.escrow}`}   short="DisputeEscrow ↗" full={ADDRESSES.escrow} />
            <EthLink href={`${SEP}/address/${ADDRESSES.registry}`} short="Audit Trail ↗"   full={ADDRESSES.registry} />
            <EthLink href={`${SEP}/address/${ADDRESSES.verifier}`} short="CREVerifier ↗"   full={ADDRESSES.verifier} />
          </div>
        </div>
      )}

      {/* In arbitration spinner */}
      {statusKey === 'IN_ARBITRATION' && (
        <div className="card-glow flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <div className="font-body text-sm font-bold text-primary">CRE Workflow Running</div>
            <div className="font-body text-xs text-muted-foreground mt-0.5">
              Chainlink CRE is querying Claude, GPT-4o, and Mistral. Verdict will be submitted on-chain when 2/3 models agree.
            </div>
          </div>
        </div>
      )}

      {/* Contract links */}
      <div className="card-sm flex flex-wrap gap-4 justify-between items-center">
        <span className="font-body text-xs text-muted-foreground">Contracts</span>
        <div className="flex gap-4 flex-wrap">
          <EthLink href={`${SEP}/address/${ADDRESSES.escrow}`}   short="DisputeEscrow" full={ADDRESSES.escrow} />
          <EthLink href={`${SEP}/address/${ADDRESSES.registry}`} short="Registry"      full={ADDRESSES.registry} />
          <EthLink href={`${SEP}/address/${ADDRESSES.verifier}`} short="CREVerifier"   full={ADDRESSES.verifier} />
        </div>
      </div>
    </div>
  );
}
