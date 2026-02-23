import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contract, parseEther, isAddress } from 'ethers';
import { Lock, Eye, ExternalLink, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import { ADDRESSES, ESCROW_ABI } from '../lib/contracts.ts';
import type { WalletState } from '../lib/wallet.ts';

interface Props { wallet: WalletState | null; }

const MIN_DEPOSIT = 0.005;
const SEP = 'https://sepolia.etherscan.io';

export default function CreateDisputePage({ wallet }: Props) {
  const navigate  = useNavigate();
  const [partyB,       setPartyB]       = useState('');
  const [description,  setDescription]  = useState('');
  const [depositEth,   setDepositEth]   = useState('0.01');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [result,       setResult]       = useState<{ disputeId: string; txHash: string } | null>(null);

  const validB    = partyB.trim() !== '' && isAddress(partyB);
  const validDesc = description.length >= 20;
  const validAmt  = parseFloat(depositEth) >= MIN_DEPOSIT;
  const canSubmit = wallet && validB && validDesc && validAmt && !submitting;

  const handleSubmit = async () => {
    if (!wallet || !canSubmit) return;
    setSubmitting(true); setError('');
    try {
      const escrow = new Contract(ADDRESSES.escrow, ESCROW_ABI, wallet.signer);
      const tx = await escrow.createDispute(partyB, description, {
        value: parseEther(depositEth),
      });
      const receipt = await tx.wait();
      const iface = escrow.interface;
      let disputeId = '';
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
          if (parsed?.name === 'DisputeCreated') { disputeId = parsed.args[0]; break; }
        } catch { /* not our event */ }
      }
      setResult({ disputeId, txHash: receipt.hash });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Transaction failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 space-y-6">
        <div className="card-glow text-center space-y-6 py-10">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 mx-auto">
            <CheckCircle className="h-7 w-7 text-green-400" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">Dispute Created</h2>
            <p className="font-body text-sm text-muted-foreground mt-2">
              Your ETH is locked in escrow. Share the Dispute ID with the opposing party so they can deposit and activate it.
            </p>
          </div>

          <div className="bg-background border border-border rounded-lg p-4 text-left space-y-4">
            <div>
              <div className="font-body text-xs text-muted-foreground mb-1.5">Dispute ID</div>
              <div className="mono text-sm text-foreground break-all">{result.disputeId}</div>
            </div>
            <div>
              <div className="font-body text-xs text-muted-foreground mb-1.5">Transaction</div>
              <a href={`${SEP}/tx/${result.txHash}`} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 mono text-xs text-primary hover:text-primary/80 break-all transition-colors">
                {result.txHash}
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(`/dispute/${result.disputeId}`)} className="btn-primary">
              View Dispute
            </button>
            <button onClick={() => setResult(null)} className="btn-secondary">
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8">

      {/* Header */}
      <div className="space-y-2">
        <p className="font-body text-xs uppercase tracking-[0.25em] text-primary">New Dispute</p>
        <h1 className="font-display text-3xl font-bold text-foreground">Create Dispute</h1>
        <p className="font-body text-sm text-muted-foreground">
          Lock ETH in a trustless escrow. Once both parties deposit, CRE will arbitrate using three independent AI models.
        </p>
      </div>

      {/* Wallet warning */}
      {!wallet && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-800/40 bg-yellow-950/20 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-body font-semibold text-yellow-300 text-sm">Wallet Required</div>
            <div className="font-body text-yellow-600 text-xs mt-0.5">Connect your MetaMask wallet using the button in the header.</div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="card space-y-6">

        {/* Party B */}
        <div>
          <label className="label">Opposing Party Address <span className="text-destructive">*</span></label>
          <input
            className={`input mono ${partyB && !validB ? 'border-destructive focus:border-destructive' : ''}`}
            placeholder="0x..."
            value={partyB}
            onChange={e => setPartyB(e.target.value)}
          />
          {partyB && !validB && (
            <p className="font-body text-xs text-destructive mt-1">Invalid Ethereum address</p>
          )}
          <p className="font-body text-xs text-muted-foreground mt-1">
            They must deposit the same amount to activate the dispute.
          </p>
        </div>

        {/* Description */}
        <div>
          <label className="label">Dispute Description <span className="text-destructive">*</span></label>
          <textarea
            className={`input resize-none h-24 ${description && !validDesc ? 'border-destructive' : ''}`}
            placeholder="Briefly describe the dispute — this becomes part of the on-chain audit trail…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className={`font-body text-xs mt-1 ${validDesc ? 'text-muted-foreground' : 'text-destructive'}`}>
            {description.length}/20 minimum characters
          </div>
        </div>

        {/* Deposit */}
        <div>
          <label className="label">Your Deposit (ETH) <span className="text-destructive">*</span></label>
          <input
            className={`input mono ${depositEth && !validAmt ? 'border-destructive' : ''}`}
            type="number"
            step="0.001"
            min={MIN_DEPOSIT}
            value={depositEth}
            onChange={e => setDepositEth(e.target.value)}
          />
          {!validAmt && (
            <p className="font-body text-xs text-destructive mt-1">Minimum deposit: {MIN_DEPOSIT} ETH</p>
          )}
          <p className="font-body text-xs text-muted-foreground mt-1">
            The opposing party must match this exactly. Total pool:{' '}
            <span className="text-foreground mono">{(parseFloat(depositEth || '0') * 2).toFixed(4)} ETH</span>
          </p>
        </div>

        {/* Privacy notice */}
        <div className="card-tee">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-body text-sm font-semibold text-foreground">Evidence stays private</div>
              <div className="font-body text-xs text-muted-foreground leading-relaxed">
                After creating the dispute, you'll submit evidence separately. Content is encrypted and fetched by Chainlink CRE via{' '}
                <strong className="text-foreground">Confidential HTTP inside a TEE</strong>. Only keccak256(content) is stored on-chain.
              </div>
              <div className="mt-2">
                <span className="chainlink-tag text-[10px]">
                  <Zap className="h-3 w-3" /> Chainlink Confidential HTTP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Fee info */}
        <div className="bg-background border border-border rounded-lg p-3 space-y-1.5">
          {[
            ['Protocol fee (on settlement)', '1% of total pool'],
            ['Fee on refund / circuit breaker', 'None'],
            ['Winner receives', '99% of total pool'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="font-body text-xs text-muted-foreground">{k}</span>
              <span className="font-body text-xs text-foreground">{v}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 font-body text-sm text-destructive">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary w-full py-3 font-body text-base">
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Confirm in MetaMask…
            </span>
          ) : 'Create Dispute & Lock ETH'}
        </button>
      </div>

      {/* What happens next */}
      <div className="card space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">What happens next?</h3>
        {[
          { n:'1', icon: Eye,          t:'Party B deposits',        d:'They call depositAndActivate() with matching ETH to make the dispute active.' },
          { n:'2', icon: Lock,         t:'Both submit evidence',    d:'Each party submits private evidence. Only hashes go on-chain.' },
          { n:'3', icon: Zap,          t:'CRE runs automatically',  d:'Chainlink CRE fetches evidence via Confidential HTTP and queries 3 AI models.' },
          { n:'4', icon: CheckCircle,  t:'Settlement',              d:'2/3 consensus releases funds to winner. No consensus = full refund.' },
        ].map(({ n, icon: Icon, t, d }) => (
          <div key={n} className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 border border-primary/20 flex-shrink-0">
              <Icon className="h-3 w-3 text-primary" />
            </div>
            <div>
              <div className="font-body text-sm font-medium text-foreground">{t}</div>
              <div className="font-body text-xs text-muted-foreground">{d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
