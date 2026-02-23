interface Row {
  feature: string;
  arbitrai: string;
  traditional: string;
  court: string;
}

const rows: Row[] = [
  { feature: 'Resolution Time', arbitrai: '< 1 minute',         traditional: '3 – 6 months',      court: '1 – 3 years' },
  { feature: 'Cost',            arbitrai: '1% protocol fee',    traditional: '$5,000 – $50,000',   court: '$10,000 – $100,000+' },
  { feature: 'Transparency',    arbitrai: '100% on-chain',       traditional: 'Closed process',     court: 'Variable' },
  { feature: 'Availability',    arbitrai: '24 / 7 worldwide',    traditional: 'Business hours',     court: 'Jurisdiction-limited' },
  { feature: 'Trust Required',  arbitrai: 'Code & cryptography', traditional: 'Single arbitrator',  court: 'Human judge + system' },
  { feature: 'Auditability',    arbitrai: 'Every vote on-chain', traditional: 'Private records',    court: 'Court filings only' },
];

export default function ComparisonTable() {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto max-w-4xl">
        <p
          className="mono text-xs uppercase tracking-widest text-center mb-3"
          style={{ color: 'hsl(45 88% 52%)' }}
        >
          Why ArbitrAI
        </p>
        <h2
          className="font-display text-3xl font-bold text-center mb-4"
          style={{ color: 'hsl(40 15% 88%)' }}
        >
          Better Than the Alternative
        </h2>
        <p
          className="font-body text-sm text-center mb-10"
          style={{ color: 'hsl(220 10% 60%)' }}
        >
          Compared to existing dispute resolution methods
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th
                  className="text-left py-3 px-4 font-display text-sm rounded-tl-xl"
                  style={{
                    background: 'hsl(220 12% 10%)',
                    color: 'hsl(220 10% 60%)',
                    borderBottom: '1px solid hsl(220 10% 18%)',
                  }}
                >
                  Feature
                </th>
                <th
                  className="py-3 px-4 font-display text-sm font-bold text-center"
                  style={{
                    background: 'hsl(45 88% 52% / 0.1)',
                    color: 'hsl(45 88% 52%)',
                    borderLeft: '1px solid hsl(45 88% 52% / 0.2)',
                    borderRight: '1px solid hsl(45 88% 52% / 0.2)',
                    borderBottom: '1px solid hsl(45 88% 52% / 0.2)',
                  }}
                >
                  ArbitrAI{' '}
                  <span
                    className="inline-block align-middle text-xs font-display font-semibold ml-1 px-2 py-0.5 rounded-full"
                    style={{
                      background: 'hsl(45 88% 52% / 0.15)',
                      color: 'hsl(45 88% 52%)',
                      border: '1px solid hsl(45 88% 52% / 0.3)',
                      fontSize: '0.65rem',
                      letterSpacing: '0.05em',
                    }}
                  >
                    RECOMMENDED
                  </span>
                </th>
                <th
                  className="py-3 px-4 font-display text-sm text-center"
                  style={{
                    background: 'hsl(220 12% 10%)',
                    color: 'hsl(220 10% 60%)',
                    borderBottom: '1px solid hsl(220 10% 18%)',
                  }}
                >
                  Traditional Arb.
                </th>
                <th
                  className="py-3 px-4 font-display text-sm text-center rounded-tr-xl"
                  style={{
                    background: 'hsl(220 12% 10%)',
                    color: 'hsl(220 10% 60%)',
                    borderBottom: '1px solid hsl(220 10% 18%)',
                  }}
                >
                  Court System
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isLast = i === rows.length - 1;
                const isOdd = i % 2 === 0;
                const rowBg = isOdd ? 'hsl(220 12% 10%)' : 'hsl(220 12% 8%)';

                return (
                  <tr key={row.feature}>
                    <td
                      className="font-body text-sm py-3 px-4"
                      style={{
                        background: rowBg,
                        color: 'hsl(220 10% 60%)',
                        borderBottom: isLast ? 'none' : '1px solid hsl(220 10% 14%)',
                        borderBottomLeftRadius: isLast ? 12 : 0,
                      }}
                    >
                      {row.feature}
                    </td>
                    <td
                      className="font-body text-sm font-semibold py-3 px-4 text-center"
                      style={{
                        background: 'hsl(45 88% 52% / 0.07)',
                        color: 'hsl(40 15% 88%)',
                        borderLeft: '1px solid hsl(45 88% 52% / 0.2)',
                        borderRight: '1px solid hsl(45 88% 52% / 0.2)',
                        borderBottom: isLast ? '1px solid hsl(45 88% 52% / 0.2)' : '1px solid hsl(45 88% 52% / 0.1)',
                        borderBottomLeftRadius: isLast ? 12 : 0,
                        borderBottomRightRadius: isLast ? 12 : 0,
                      }}
                    >
                      <span style={{ color: 'hsl(45 88% 52%)', marginRight: 6 }}>&#10003;</span>
                      {row.arbitrai}
                    </td>
                    <td
                      className="font-body text-sm py-3 px-4 text-center"
                      style={{
                        background: rowBg,
                        color: 'hsl(220 10% 55%)',
                        borderBottom: isLast ? 'none' : '1px solid hsl(220 10% 14%)',
                      }}
                    >
                      {row.traditional}
                    </td>
                    <td
                      className="font-body text-sm py-3 px-4 text-center"
                      style={{
                        background: rowBg,
                        color: 'hsl(220 10% 55%)',
                        borderBottom: isLast ? 'none' : '1px solid hsl(220 10% 14%)',
                        borderBottomRightRadius: isLast ? 12 : 0,
                      }}
                    >
                      {row.court}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p
          className="font-body text-xs text-center mt-4"
          style={{ color: 'hsl(220 10% 45%)' }}
        >
          *Based on typical freelance disputes under $10,000 USD
        </p>
      </div>
    </section>
  );
}
