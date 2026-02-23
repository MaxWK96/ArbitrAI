import { Play, ArrowRight } from "lucide-react";

const DemoSection = () => {
  return (
    <section id="demo" className="py-24 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl border border-border bg-card p-10 text-center md:p-16">
          <p className="mb-2 font-body text-xs uppercase tracking-[0.25em] text-primary">
            Live on Sepolia
          </p>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground sm:text-4xl">
            See It Run End‑to‑End
          </h2>
          <p className="mx-auto mb-8 max-w-lg font-body text-sm leading-relaxed text-muted-foreground">
            Click one button and watch the full dispute lifecycle — including the circuit breaker — 
            unfold in real time.
          </p>

          {/* Mini preview of steps */}
          <div className="mb-10 mx-auto max-w-md rounded-lg border border-border bg-background p-4 text-left">
            <p className="mb-3 font-body text-[10px] uppercase tracking-[0.2em] text-primary">
              CRE Workflow Log
            </p>
            <div className="space-y-1.5 font-mono text-xs text-muted-foreground">
              <p><span className="text-primary">▸</span> createDispute() — 0.05 ETH locked</p>
              <p><span className="text-primary">▸</span> evidence encrypted → hash committed</p>
              <p><span className="text-primary">▸</span> CRE trigger → 3 AI models queried</p>
              <p><span className="text-primary">▸</span> consensus: 2/3 → verdict signed</p>
              <p><span className="text-primary">▸</span> ecrecover ✓ → ETH released to winner</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href="/demo"
              className="glow-gold inline-flex items-center gap-2.5 rounded-lg bg-primary px-8 py-4 font-body text-sm font-semibold text-primary-foreground transition-all hover:brightness-110"
            >
              <Play className="h-4 w-4" />
              Launch Interactive Demo
            </a>
            <a
              href="/create"
              className="inline-flex items-center gap-2 font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Or create a real dispute
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DemoSection;
