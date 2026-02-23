import { Lock, Eye, Zap, CheckCircle } from "lucide-react";

const steps = [
  {
    icon: Lock,
    num: "01",
    title: "Lock ETH in Escrow",
    desc: "Both parties deposit equal ETH into a trustless smart contract. No admin can touch it — only CRE can release it.",
  },
  {
    icon: Eye,
    num: "02",
    title: "Submit Evidence Privately",
    desc: "Evidence is encrypted and sent to the ArbitrAI server. Only keccak256(content) is committed on‑chain. The CRE workflow fetches it via Confidential HTTP inside a TEE.",
  },
  {
    icon: Zap,
    num: "03",
    title: "CRE Orchestrates AI Consensus",
    desc: "Chainlink CRE queries Claude Opus 4.6, GPT‑4o, and Mistral Large in parallel. Each model independently analyzes evidence and votes. 2/3 must agree.",
  },
  {
    icon: CheckCircle,
    num: "04",
    title: "ECDSA‑Signed Settlement",
    desc: "The CRE operator key signs the WorkflowVerdict struct. CREVerifier.sol checks the signature on‑chain, then calls executeVerdict() — transferring funds atomically.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <p className="mb-2 text-center font-body text-xs uppercase tracking-[0.25em] text-primary">
          Process
        </p>
        <h2 className="text-center font-display text-3xl font-bold text-foreground sm:text-4xl">
          How It Works
        </h2>
        <p className="mt-3 text-center font-body text-sm text-muted-foreground">
          Every step is verifiable on‑chain
        </p>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {steps.map((s) => (
            <div
              key={s.num}
              className="group rounded-xl border border-border bg-card p-8 transition-colors hover:border-primary/30"
            >
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="font-body text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  Step {s.num}
                </span>
              </div>
              <h3 className="mb-3 font-display text-xl font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
