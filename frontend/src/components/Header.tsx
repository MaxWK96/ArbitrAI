import { Link, useLocation } from 'react-router-dom';
import { Scale, ExternalLink, PlusCircle } from 'lucide-react';
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
    `font-body text-sm transition-colors ${
      location.pathname === path
        ? 'text-foreground'
        : 'text-muted-foreground hover:text-foreground'
    }`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-primary" />
          <div>
            <span className="font-display text-base font-bold text-foreground tracking-wide">ArbitrAI</span>
            <span className="ml-2 rounded border border-gold-subtle px-1.5 py-0.5 font-body text-[10px] uppercase tracking-widest text-muted-foreground">
              Sepolia
            </span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden md:flex items-center gap-7">
          <Link to="/create" className={navCls('/create')}>New Dispute</Link>
          <Link to="/demo"   className={navCls('/demo')}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live Demo
            </span>
          </Link>
        </nav>

        {/* Right */}
        <div className="flex items-center gap-4">
          {/* Contract links */}
          <div className="hidden lg:flex items-center gap-4">
            {([['Escrow', ESCROW], ['Registry', REGISTRY], ['Verifier', VERIFIER]] as [string,string][]).map(([label, addr]) => (
              <a key={label}
                 href={`https://sepolia.etherscan.io/address/${addr}`}
                 target="_blank" rel="noreferrer"
                 className="flex items-center gap-1 font-body text-xs text-muted-foreground hover:text-primary transition-colors">
                {label}
                <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>

          {error && <span className="text-xs text-destructive max-w-[120px] truncate">{error}</span>}

          {wallet ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.7)]" />
                <span className="font-body text-sm mono text-foreground">{shortenAddress(wallet.address)}</span>
              </div>
              <button onClick={onDisconnect} className="text-muted-foreground hover:text-foreground text-xs transition-colors px-1">✕</button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="glow-gold inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
            >
              {connecting ? (
                <>
                  <span className="w-3.5 h-3.5 border border-primary-foreground/60 border-t-transparent rounded-full animate-spin" />
                  Connecting
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
