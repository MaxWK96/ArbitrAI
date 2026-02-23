import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contract, parseEther, isAddress } from 'ethers';
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
      // Parse DisputeCreated event to get disputeId
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
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-6">
        <div className="card-glow text-center space-y-5">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-white">Dispute Created</h2>
          <p className="text-gray-400 text-sm">
            Your ETH is locked in escrow. Share the Dispute ID with the opposing party so they can deposit and activate the dispute.
          </p>

          <div className="bg-gray-950/60 border border-gray-800 rounded-lg p-4 text-left space-y-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Dispute ID</div>
              <div className="font-mono text-sm text-white break-all">{result.disputeId}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Transaction</div>
              <a href={`${SEP}/tx/${result.txHash}`} target="_blank" rel="noreferrer"
                 className="font-mono text-xs text-brand-400 hover:text-brand-300 break-all">
                {result.txHash} ↗
              </a>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/dispute/${result.disputeId}`)}
              className="btn-primary"
            >
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
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Create Dispute</h1>
        <p className="text-gray-400 text-sm">
          Lock ETH in a trustless escrow. Once both parties deposit, CRE will arbitrate using three independent AI models.
        </p>
      </div>

      {/* Warning if no wallet */}
      {!wallet && (
        <div className="card border-yellow-800/60 bg-yellow-950/20">
          <div className="flex items-start gap-3">
            <span className="text-yellow-400 text-lg flex-shrink-0">⚠️</span>
            <div>
              <div className="font-semibold text-yellow-300 text-sm">Wallet Required</div>
              <div className="text-yellow-500 text-xs mt-0.5">Connect your MetaMask wallet to create a dispute.</div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="card space-y-6">

        {/* Party B */}
        <div>
          <label className="label">Opposing Party Address <span className="text-red-500">*</span></label>
          <input
            className={`input mono ${partyB && !validB ? 'border-red-700 focus:border-red-600' : ''}`}
            placeholder="0x..."
            value={partyB}
            onChange={e => setPartyB(e.target.value)}
          />
          {partyB && !validB && <p className="text-xs text-red-400 mt-1">Invalid Ethereum address</p>}
          <p className="text-xs text-gray-600 mt-1">They must deposit the same amount to activate the dispute.</p>
        </div>

        {/* Description */}
        <div>
          <label className="label">Dispute Description <span className="text-red-500">*</span></label>
          <textarea
            className={`input resize-none h-24 ${description && !validDesc ? 'border-red-700' : ''}`}
            placeholder="Briefly describe the dispute — this becomes part of the on-chain audit trail…"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <div className={`text-xs mt-1 ${validDesc ? 'text-gray-600' : 'text-red-400'}`}>
            {description.length}/20 minimum characters
          </div>
        </div>

        {/* Deposit */}
        <div>
          <label className="label">Your Deposit (ETH) <span className="text-red-500">*</span></label>
          <input
            className={`input mono ${depositEth && !validAmt ? 'border-red-700' : ''}`}
            type="number"
            step="0.001"
            min={MIN_DEPOSIT}
            value={depositEth}
            onChange={e => setDepositEth(e.target.value)}
          />
          {!validAmt && <p className="text-xs text-red-400 mt-1">Minimum deposit: {MIN_DEPOSIT} ETH</p>}
          <p className="text-xs text-gray-600 mt-1">
            The opposing party must match this amount exactly. Total pool: <span className="text-white mono">{(parseFloat(depositEth||'0')*2).toFixed(4)} ETH</span>
          </p>
        </div>

        {/* Privacy notice */}
        <div className="card-tee">
          <div className="flex items-start gap-3">
            <span className="text-purple-400 text-lg flex-shrink-0">🔐</span>
            <div className="space-y-1">
              <div className="text-sm font-semibold text-purple-300">Evidence stays private</div>
              <div className="text-xs text-gray-500 leading-relaxed">
                After creating the dispute, you'll submit your evidence separately. Content is encrypted and fetched by Chainlink CRE via <strong className="text-purple-400">Confidential HTTP inside a TEE</strong>. Only the keccak256 hash is stored on-chain — node operators never see your evidence.
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="chainlink-tag text-[10px]">⚡ Chainlink Confidential HTTP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Fee info */}
        <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-3 text-xs text-gray-500 space-y-1">
          <div className="flex justify-between"><span>Protocol fee (on settlement)</span><span className="text-gray-300">1% of total pool</span></div>
          <div className="flex justify-between"><span>Fee on refund / circuit breaker</span><span className="text-green-400">None</span></div>
          <div className="flex justify-between"><span>Winner receives</span><span className="text-gray-300">99% of total pool</span></div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-800/60 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary w-full py-3 text-base"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Confirm in MetaMask…
            </span>
          ) : 'Create Dispute & Lock ETH'}
        </button>
      </div>

      {/* How it works summary */}
      <div className="card space-y-4">
        <h3 className="font-semibold text-white text-sm">What happens next?</h3>
        {[
          { n:'1', t:'Party B deposits', d:'They call depositAndActivate() with matching ETH to make the dispute active.' },
          { n:'2', t:'Both submit evidence', d:'Each party submits private evidence. Only hashes go on-chain.' },
          { n:'3', t:'CRE runs automatically', d:'Chainlink CRE fetches evidence via Confidential HTTP and queries 3 AI models.' },
          { n:'4', t:'Settlement',  d:'2/3 consensus releases funds to winner. No consensus = full refund.' },
        ].map(s => (
          <div key={s.n} className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-brand-900 border border-brand-700 text-brand-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{s.n}</div>
            <div>
              <div className="text-sm font-medium text-gray-300">{s.t}</div>
              <div className="text-xs text-gray-500">{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
