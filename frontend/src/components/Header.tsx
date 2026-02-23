import { Link, useLocation } from 'react-router-dom';
import { connectWallet, shortenAddress } from '../lib/wallet.ts';
import type { WalletState } from '../lib/wallet.ts';
import { useState } from 'react';

interface Props {
  wallet: WalletState | null;
  onConnected: (w: WalletState) => void;
  onDisconnect: () => void;
}

const ESCROW   = '0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7';
const REGISTRY = '0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5';
const VERIFIER = '0x18b34E31290Ac10dE263943cD9D617EE1f570133';

export default function Header({ wallet, onConnected, onDisconnect }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();

  const handleConnect = async () => {
    setConnecting(true);
    setError('');
    try {
      const w = await connectWallet();
      onConnected(w);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const navCls = (path: string) =>
    `px-3 py-1.5 rounded-md text-sm transition-colors ${
      location.pathname === path
        ? 'bg-gray-800 text-white'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
    }`;

  return (
    <header className="border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="relative w-8 h-8">
            <div className="absolute inset-0 bg-brand-600 rounded-lg opacity-20 blur-sm" />
            <div className="relative w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-[0_0_10px_rgba(59,99,248,0.35)]">
              <svg viewBox="0 0 20 20" fill="none" className="w-4.5 h-4.5 text-white">
                <path d="M10 2L2 6.5l8 4.5 8-4.5L10 2z"  fill="currentColor"/>
                <path d="M2 10l8 4.5 8-4.5"               stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M2 13.5l8 4.5 8-4.5"             stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45"/>
              </svg>
            </div>
          </div>
          <div className="leading-none">
            <div className="font-bold text-white text-[15px]">ArbitrAI</div>
            <div className="text-[10px] text-gray-500 mono mt-0.5">Sepolia Testnet</div>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-0.5">
          <Link to="/"       className={navCls('/')}>Home</Link>
          <Link to="/create" className={navCls('/create')}>New Dispute</Link>
          <Link to="/demo"   className={`${navCls('/demo')} flex items-center gap-1.5`}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live Demo
          </Link>
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          {/* Contract quick-links */}
          <div className="hidden lg:flex items-center gap-3 border-r border-gray-800 pr-3">
            {([['Escrow', ESCROW], ['Registry', REGISTRY], ['Verifier', VERIFIER]] as [string,string][]).map(([label, addr]) => (
              <a key={label}
                 href={`https://sepolia.etherscan.io/address/${addr}`}
                 target="_blank" rel="noreferrer"
                 title={addr}
                 className="text-xs text-gray-600 hover:text-brand-400 transition-colors mono flex items-center gap-0.5 group">
                {label}
                <svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            ))}
          </div>

          {error && <span className="text-xs text-red-400 max-w-[120px] truncate">{error}</span>}

          {wallet ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.7)]" />
                <span className="text-sm mono text-gray-200">{shortenAddress(wallet.address)}</span>
              </div>
              <button onClick={onDisconnect} className="text-gray-600 hover:text-gray-400 text-xs transition-colors px-1">✕</button>
            </div>
          ) : (
            <button onClick={handleConnect} disabled={connecting} className="btn-primary text-sm py-2">
              {connecting
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border border-white/60 border-t-transparent rounded-full animate-spin"/>Connecting</span>
                : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
