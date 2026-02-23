import { Play, PlusCircle } from "lucide-react";
import DisputeLifecycle from "./DisputeLifecycle";

const HeroSection = () => {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-16">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gold-subtle bg-secondary px-4 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-gold" />
          <span className="font-body text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Chainlink Convergence Hackathon 2026
          </span>
        </div>

        {/* Title - single strong typographic unit */}
        <h1 className="mb-6 font-display text-5xl font-800 leading-[1.15] tracking-tight text-foreground sm:text-6xl md:text-7xl">
          AI‑Powered{" "}
          <span className="text-gold-gradient">Dispute Resolution</span>
        </h1>

        <p className="mx-auto mb-10 max-w-xl font-body text-base leading-relaxed text-muted-foreground sm:text-lg">
          Three independent AI models reach cryptographic consensus inside Chainlink CRE. 
          Evidence stays private. Every verdict is signed and verifiable on‑chain. 
          No human arbitrator. No admin key.
        </p>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="/demo"
            className="glow-gold inline-flex items-center gap-2.5 rounded-lg bg-primary px-7 py-3.5 font-body text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
          >
            <Play className="h-4 w-4" />
            Watch Live Demo
          </a>
          <a
            href="/create"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-7 py-3.5 font-body text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
          >
            <PlusCircle className="h-4 w-4" />
            Create a Dispute
          </a>
        </div>
        <p className="mt-4 font-body text-xs text-muted-foreground">
          Full CRE workflow on Sepolia in under 60 seconds.
        </p>

        {/* Live dispute lifecycle animation */}
        <div className="mt-12 w-full max-w-lg mx-auto">
          <DisputeLifecycle />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
