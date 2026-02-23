import { ExternalLink } from 'lucide-react';

interface Contract {
  name: string;
  addr: string;
  desc: string;
}

const contracts: Contract[] = [
  {
    name: 'DisputeEscrow',
    addr: '0x97D02A149aAEB0C60f6DFc335d944f84dCFD9ec7',
    desc: 'Holds ETH during arbitration. Only CRE can release funds.',
  },
  {
    name: 'ArbitrationRegistry',
    addr: '0xFF8DaeC3aEC58Ec1D2F48e94d4421783478cd8B5',
    desc: 'Immutable audit trail. Records every state transition on-chain.',
  },
  {
    name: 'CREVerifier',
    addr: '0x18b34E31290Ac10dE263943cD9D617EE1f570133',
    desc: 'Verifies ECDSA operator signature. Enforces 2/3 consensus threshold.',
  },
];

const ETHERSCAN_BASE = 'https://sepolia.etherscan.io/address/';

export default function DeployedContracts() {
  return (
    <section className="py-20 px-6">
      {/* Header */}
      <div className="text-center mb-10 space-y-3">
        <p className="font-body text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
          Deployed &amp; Verified
        </p>
        <h2 className="font-display text-3xl font-bold">
          Live on Sepolia Testnet
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-md mx-auto">
          Three auditable smart contracts — click any address to verify on Etherscan
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {contracts.map((c) => (
          <div
            key={c.addr}
            className="card rounded-xl border border-border bg-card p-5 flex flex-col gap-4 hover:border-primary/40 transition-colors"
          >
            {/* Contract name + LIVE badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-bold text-base leading-tight">
                {c.name}
              </span>
              <span className="badge-green flex items-center gap-1.5 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold font-body text-green-400 bg-green-400/10 border border-green-400/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                </span>
                LIVE
              </span>
            </div>

            {/* Address */}
            <a
              href={`${ETHERSCAN_BASE}${c.addr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-xs break-all flex items-start gap-1.5 group"
              style={{ color: 'var(--primary)' }}
            >
              <span className="leading-relaxed">{c.addr}</span>
              <ExternalLink
                size={12}
                className="shrink-0 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
              />
            </a>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Description */}
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              {c.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center font-body text-xs text-muted-foreground mt-8">
        Deployed 2026-02-20 · Sepolia Testnet (chainId: 11155111) · Deployer: 0xd276…546
      </p>
    </section>
  );
}
