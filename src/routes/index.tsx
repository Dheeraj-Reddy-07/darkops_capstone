import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")(({
  head: () => ({
    meta: [
      { title: "DarkOps - Operational Intelligence Platform" },
      {
        name: "description",
        content:
          "DarkOps is a real-time dark-store operational intelligence platform for monitoring, case management, fraud detection, and executive analytics.",
      },
    ],
  }),
  component: LandingPage,
} as any));

const PILLARS = [
  {
    icon: "◈",
    label: "Dark Store Network",
    desc: "Live PulseScore for every store. Equipment failures, SLA breaches, and inventory issues surface instantly.",
  },
  {
    icon: "⬡",
    label: "Case Operations",
    desc: "Complaint triage, assignment, escalation, and resolution workflows for operations agents.",
  },
  {
    icon: "◆",
    label: "Fraud & Risk",
    desc: "AI-assisted fraud review queue. Analyst decisioning with full claim context and confidence scores.",
  },
  {
    icon: "◉",
    label: "Executive Intelligence",
    desc: "Network-wide metrics, city-level roll-ups, and a grounded natural-language analytics assistant.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-[5px] bg-primary/15">
              <span className="size-3 rounded-[3px] bg-primary" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">
              Dark<span className="text-primary">Ops</span>
            </span>
            <span className="label-caps ml-3 hidden rounded border border-border/70 px-2 py-0.5 sm:inline-block">
              Operational Intelligence
            </span>
          </div>
          <Link
            to="/login"
            className="rounded-sm bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface px-3 py-1 text-xs text-muted-foreground mb-8">
            <span className="size-1.5 rounded-full bg-ok animate-pulse" />
            Live - 14 dark-store network · Bengaluru metro
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl text-foreground">
            Operational intelligence<br />
            <span className="text-primary">for dark-store networks.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground leading-relaxed">
            DarkOps gives ops managers, agents, fraud analysts, and executives a
            single command center to monitor store health, resolve complaints,
            review fraud risk, and understand network performance - in real time.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/login"
              className="rounded-sm bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Access DarkOps →
            </Link>
            <a
              href="#pillars"
              className="rounded-sm border border-border bg-surface px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            >
              Explore capabilities
            </a>
          </div>

          {/* Live status bar */}
          <div className="mx-auto mt-14 max-w-3xl rounded-sm border border-border bg-surface p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span className="size-1.5 rounded-full bg-ok" />
              Network snapshot - live
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-left">
              {[
                { label: "Stores monitored", value: "14" },
                { label: "Active cases", value: "47" },
                { label: "Network PulseScore", value: "74/100" },
                { label: "Fraud reviews open", value: "8" },
              ].map((kpi) => (
                <div key={kpi.label}>
                  <p className="label-caps">{kpi.label}</p>
                  <p className="num mt-1 text-xl font-semibold text-foreground">{kpi.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section id="pillars" className="border-t border-border/50 bg-surface/30">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-center text-lg font-semibold tracking-tight text-foreground mb-12">
              Four modules. One platform.
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PILLARS.map((p) => (
                <div
                  key={p.label}
                  className="rounded-sm border border-border bg-surface p-5"
                >
                  <span className="text-2xl text-primary">{p.icon}</span>
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{p.label}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border/50">
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-xl font-semibold text-foreground">
              Ready to see it live?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Use the demo credentials on the login page to explore each role's experience.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex rounded-sm bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Access DarkOps
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 py-5">
        <div className="mx-auto max-w-6xl flex items-center justify-between text-xs text-muted-foreground">
          <span>DarkOps · Deloitte Capstone 2026</span>
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ok" />
            All systems operational
          </span>
        </div>
      </footer>
    </div>
  );
}
