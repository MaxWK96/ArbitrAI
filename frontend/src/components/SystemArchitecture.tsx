const SystemArchitecture = () => {
  return (
    <section id="architecture" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <p className="mb-2 text-center font-body text-xs uppercase tracking-[0.25em] text-primary">
          Architecture
        </p>
        <h2 className="mb-4 text-center font-display text-3xl font-bold text-foreground sm:text-4xl">
          System Architecture
        </h2>
        <p className="mb-16 text-center font-body text-sm text-muted-foreground">
          Live on Sepolia
        </p>

        {/* Two-column layout */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Left: explanation */}
          <div className="space-y-6">
            <div>
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                Dispute Lifecycle
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                Alice and Bob lock ETH into the DisputeEscrow contract. The ArbitrationRegistry 
                records the dispute. Evidence is encrypted with AES‑256‑GCM and stored off‑chain 
                — only the keccak256 hash is committed on‑chain for integrity verification.
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                CRE Workflow
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                Chainlink CRE orchestrates the entire arbitration pipeline inside a Trusted 
                Execution Environment. Three AI models vote independently, a 2/3 consensus 
                threshold is applied, and the verdict is cryptographically signed before 
                on‑chain submission.
              </p>
            </div>
            <div>
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                On‑Chain Verification
              </h3>
              <p className="font-body text-sm leading-relaxed text-muted-foreground">
                CREVerifier.sol recovers the signer via ecrecover, checks evidence hash 
                integrity, and enforces a 1‑hour staleness window before releasing ETH 
                to the winner atomically.
              </p>
            </div>
          </div>

          {/* Right: pseudo-code flow */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="space-y-0 font-mono text-xs leading-loose text-muted-foreground">
              <p className="text-foreground">
                <span className="text-primary">// Dispute Creation</span>
              </p>
              <p>Alice/Bob → DisputeEscrow.createDispute() <span className="text-primary">[ETH locked]</span></p>
              <p>→ ArbitrationRegistry.registerDispute()</p>
              <p>→ Evidence Server <span className="text-primary">[AES-256-GCM]</span></p>
              <p className="pt-4 text-foreground">
                <span className="text-primary">// CRE Workflow</span>
              </p>
              <p><span className="text-primary">[1]</span> eth_call → read dispute from chain</p>
              <p><span className="text-primary">[2]</span> Confidential HTTP → fetch evidence (TEE)</p>
              <p><span className="text-primary">[3]</span> Claude + GPT‑4o + Mistral → parallel AI</p>
              <p><span className="text-primary">[4]</span> applyConsensus(votes) → 2/3 threshold</p>
              <p><span className="text-primary">[5]</span> secp256k1.sign(verdictHash, operatorKey)</p>
              <p><span className="text-primary">[6]</span> CREVerifier.submitVerdict(verdict, sig)</p>
              <p className="pt-4 text-foreground">
                <span className="text-primary">// Verification</span>
              </p>
              <p>ecrecover(hash, sig) == operatorAddress <span className="text-primary">✓</span></p>
              <p>evidenceHash integrity check <span className="text-primary">✓</span></p>
              <p>staleness {"<"} 1 hour <span className="text-primary">✓</span></p>
              <p className="pt-2">DisputeEscrow.executeVerdict(winner) → <span className="text-primary">ETH released</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SystemArchitecture;
