import { useState, useEffect } from 'react';

interface Step {
  icon: string;
  label: string;
  sub: string;
  color: string;
}

const steps: Step[] = [
  { icon: '🔐', label: 'ETH Locked in Escrow',         sub: '0.01 ETH × 2 parties · Pool: 0.02 ETH',              color: 'text-primary' },
  { icon: '📋', label: 'Evidence Submitted',            sub: 'keccak256(content) committed on-chain · Private via TEE', color: 'text-primary' },
  { icon: '🤖', label: 'Claude Opus votes YES',         sub: 'Confidence: 87% · "Deliverables met per contract"',   color: 'text-green-400' },
  { icon: '🧠', label: 'GPT-4o votes YES',              sub: 'Confidence: 82% · "Timeline honored, scope met"',     color: 'text-green-400' },
  { icon: '💡', label: 'Mistral votes YES',             sub: 'Confidence: 76% · "Contract terms satisfied"',        color: 'text-green-400' },
  { icon: '✍️', label: '3/3 Consensus · ECDSA Signed', sub: 'secp256k1.sign(verdictHash, operatorKey) · CREVerifier', color: 'text-primary' },
  { icon: '🏆', label: 'Funds Released to Winner',     sub: 'Winner receives 0.0198 ETH (99%) · Fee: 0.0002 ETH',  color: 'text-green-400' },
];

const INTERVAL_MS = 2000;

export default function DisputeLifecycle() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStep((prev) => (prev + 1) % steps.length);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const current = steps[step];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <span className="font-body text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Dispute Lifecycle
        </span>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="font-body text-xs font-semibold text-green-400 uppercase tracking-wide">
            Live Simulation
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative px-5 pt-6 pb-4 min-h-[160px]">
        {/* Step counter + looping indicator */}
        <div className="absolute top-4 right-5 flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--primary)' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: 'var(--primary)' }} />
            </span>
            <span className="font-body text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
              Looping
            </span>
          </div>
          <span className="font-body text-xs text-muted-foreground tabular-nums">
            Step {step + 1} / {steps.length}
          </span>
        </div>

        {/* Animated step content — key re-mounts to replay fade-in */}
        <div key={step} className="fade-in flex flex-col items-center text-center gap-3">
          <span className="text-5xl leading-none select-none">{current.icon}</span>
          <span className={`font-display text-xl font-bold leading-snug ${current.color}`}>
            {current.label}
          </span>
          <span className="font-body text-sm text-muted-foreground max-w-xs leading-relaxed">
            {current.sub}
          </span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 px-5 pb-4">
        {steps.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={
              i === step
                ? { backgroundColor: 'var(--primary)', width: '1.5rem', height: '0.375rem' }
                : { backgroundColor: 'var(--border)', width: '0.375rem', height: '0.375rem' }
            }
          />
        ))}
      </div>

      {/* Gold progress bar */}
      <div className="h-0.5 w-full" style={{ backgroundColor: 'var(--border)' }}>
        <div
          key={step}
          className="h-full"
          style={{
            backgroundColor: 'var(--primary)',
            width: '100%',
            animation: `progress-fill ${INTERVAL_MS}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
