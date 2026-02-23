const metrics = [
  { value: "3", label: "AI MODELS", detail: "Claude · GPT‑4o · Mistral" },
  { value: "2/3", label: "CONSENSUS", detail: "required for settlement" },
  { value: "100%", label: "REFUND ON FAIL", detail: "no fee when circuit breaks" },
  { value: "1%", label: "PROTOCOL FEE", detail: "only on successful settlement" },
];

const MetricsSection = () => {
  return (
    <section className="py-20 px-6">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-border bg-card p-6 text-center"
          >
            <p className="font-display text-3xl font-bold text-primary md:text-4xl">
              {m.value}
            </p>
            <p className="mt-2 font-body text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
              {m.label}
            </p>
            <p className="mt-1 font-body text-xs text-muted-foreground">{m.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default MetricsSection;
