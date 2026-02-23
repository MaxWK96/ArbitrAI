export default function FlowDiagram() {
  return (
    <section id="architecture" className="py-24 px-6">
      <div className="mx-auto max-w-5xl">
        <p className="mono text-xs uppercase tracking-widest text-center mb-3" style={{ color: 'hsl(45 88% 52%)' }}>
          System Architecture
        </p>
        <h2 className="font-display text-3xl font-bold text-center mb-4" style={{ color: 'hsl(40 15% 88%)' }}>
          How ArbitrAI Works
        </h2>
        <p className="font-body text-sm text-center mb-12" style={{ color: 'hsl(220 10% 60%)' }}>
          From dispute submission to on-chain settlement — fully trustless, fully automated.
        </p>

        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 700 560"
            className="w-full"
            xmlns="http://www.w3.org/2000/svg"
            style={{ minWidth: 420 }}
          >
            <defs>
              {/* Path definitions for animateMotion */}
              <path id="p1" d="M102,64 C102,92 350,92 350,120" />
              <path id="p2" d="M597,64 C597,92 350,92 350,120" />
              <path id="p3" d="M350,170 L350,230" />
              <path id="p4" d="M350,280 C350,312 105,312 105,340" />
              <path id="p5" d="M350,280 L350,340" />
              <path id="p6" d="M350,280 C350,312 595,312 595,340" />
              <path id="p7" d="M105,384 C105,422 350,422 350,450" />
              <path id="p8" d="M350,406 L350,450" />
              <path id="p9" d="M595,384 C595,422 350,422 350,450" />
              <path id="p10" d="M350,500 L350,514" />
            </defs>

            {/* Visible connector lines */}
            <path d="M102,64 C102,92 350,92 350,120" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M597,64 C597,92 350,92 350,120" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M350,170 L350,230" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M350,280 C350,312 105,312 105,340" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M350,280 L350,340" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M350,280 C350,312 595,312 595,340" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M105,384 C105,422 350,422 350,450" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M350,406 L350,450" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M595,384 C595,422 350,422 350,450" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />
            <path d="M350,500 L350,514" stroke="hsl(220 10% 20%)" strokeWidth="1.5" fill="none" />

            {/* Party A */}
            <rect x="30" y="20" width="145" height="44" rx="10" fill="hsl(220 12% 12%)" stroke="hsl(220 10% 20%)" strokeWidth="1.5" />
            <text x="102" y="42" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">Party A</text>

            {/* Party B */}
            <rect x="525" y="20" width="145" height="44" rx="10" fill="hsl(220 12% 12%)" stroke="hsl(220 10% 20%)" strokeWidth="1.5" />
            <text x="597" y="42" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">Party B</text>

            {/* DisputeEscrow Contract — gold border */}
            <rect x="175" y="120" width="350" height="50" rx="10" fill="hsl(45 88% 52% / 0.05)" stroke="hsl(45 88% 52% / 0.4)" strokeWidth="1.5" />
            <text x="350" y="143" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">DisputeEscrow Contract</text>
            <text x="350" y="158" textAnchor="middle" dominantBaseline="middle" fill="hsl(45 88% 52%)" fontFamily="Inter,sans-serif" fontSize="10">ETH locked</text>

            {/* CRE Workflow — gold border */}
            <rect x="150" y="230" width="400" height="50" rx="10" fill="hsl(45 88% 52% / 0.05)" stroke="hsl(45 88% 52% / 0.4)" strokeWidth="1.5" />
            <text x="330" y="255" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">Chainlink CRE Workflow</text>
            <rect x="496" y="239" width="44" height="18" rx="4" fill="hsl(45 88% 52% / 0.15)" stroke="hsl(45 88% 52% / 0.3)" strokeWidth="1" />
            <text x="518" y="248" textAnchor="middle" dominantBaseline="middle" fill="hsl(45 88% 52%)" fontFamily="Inter,sans-serif" fontSize="9" fontWeight="700">TEE</text>

            {/* Claude Opus */}
            <rect x="20" y="340" width="170" height="44" rx="10" fill="hsl(220 12% 12%)" stroke="hsl(220 10% 20%)" strokeWidth="1.5" />
            <text x="105" y="362" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">Claude Opus</text>

            {/* GPT-4o */}
            <rect x="265" y="340" width="170" height="44" rx="10" fill="hsl(220 12% 12%)" stroke="hsl(220 10% 20%)" strokeWidth="1.5" />
            <text x="350" y="362" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">GPT-4o</text>

            {/* Mistral Large */}
            <rect x="510" y="340" width="170" height="44" rx="10" fill="hsl(220 12% 12%)" stroke="hsl(220 10% 20%)" strokeWidth="1.5" />
            <text x="595" y="362" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">Mistral Large</text>

            {/* ArbitrationRegistry */}
            <rect x="170" y="450" width="360" height="50" rx="10" fill="hsl(220 12% 12%)" stroke="hsl(220 10% 20%)" strokeWidth="1.5" />
            <text x="330" y="473" textAnchor="middle" dominantBaseline="middle" fill="hsl(40 15% 88%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="600">ArbitrationRegistry</text>
            <text x="330" y="488" textAnchor="middle" dominantBaseline="middle" fill="hsl(220 10% 55%)" fontFamily="Inter,sans-serif" fontSize="10">ECDSA signed</text>

            {/* Payout — gold stroke */}
            <rect x="250" y="514" width="200" height="40" rx="10" fill="hsl(45 88% 52% / 0.05)" stroke="hsl(45 88% 52% / 0.5)" strokeWidth="1.5" />
            <text x="350" y="534" textAnchor="middle" dominantBaseline="middle" fill="hsl(45 88% 52%)" fontFamily="Inter,sans-serif" fontSize="13" fontWeight="700">Payout</text>

            {/* Animated dots — p1 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p1" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p1" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p2 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p2" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p2" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p3 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p3" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p3" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p4 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p4" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p4" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p5 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p5" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p5" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p6 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p6" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p6" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p7 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p7" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p7" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p8 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p8" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p8" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p9 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p9" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p9" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>

            {/* Animated dots — p10 */}
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="0s"><mpath href="#p10" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="0s" />
            </circle>
            <circle r="4" fill="hsl(45 88% 52%)">
              <animateMotion dur="2.5s" repeatCount="indefinite" begin="1.25s"><mpath href="#p10" /></animateMotion>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur="2.5s" repeatCount="indefinite" begin="1.25s" />
            </circle>
          </svg>
        </div>
      </div>
    </section>
  );
}
