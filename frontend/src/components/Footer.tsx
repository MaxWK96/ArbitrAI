import { Scale } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border py-10 px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold text-foreground">ArbitrAI</span>
        </div>
        <p className="font-body text-xs text-muted-foreground">
          Decentralized dispute resolution powered by Chainlink CRE & multi‑model AI consensus.
        </p>
        <p className="font-body text-xs text-muted-foreground">
          Chainlink Convergence Hackathon 2026
        </p>
      </div>
    </footer>
  );
};

export default Footer;
