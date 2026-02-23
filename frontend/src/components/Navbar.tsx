import { Scale, ExternalLink } from "lucide-react";

const Navbar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 text-primary" />
          <div>
            <span className="font-display text-lg font-bold text-foreground tracking-wide">ArbitrAI</span>
            <span className="ml-2 rounded border border-gold-subtle px-1.5 py-0.5 font-body text-[10px] uppercase tracking-widest text-muted-foreground">
              Sepolia Testnet
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground">
            How It Works
          </a>
          <a href="#architecture" className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground">
            Architecture
          </a>
          <a href="#demo" className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground">
            Live Demo
          </a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {[
            { label: "Escrow", addr: "0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7" },
            { label: "Registry", addr: "0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5" },
            { label: "Verifier", addr: "0x18b34E31290Ac10dE263943cD9D617EE1f570133" },
          ].map((c) => (
            <a
              key={c.label}
              href={`https://sepolia.etherscan.io/address/${c.addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-body text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              {c.label}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
