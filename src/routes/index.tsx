import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef } from "react";
import {
  ArrowRight,
  Layers,
  ShieldAlert,
  BarChart3,
  Users,
  Store,
  AlertCircle,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DarkOps — Operational Intelligence for Dark-Store Networks" },
      {
        name: "description",
        content:
          "One operating layer for store health, case operations, fraud risk, and network performance across your dark-store network.",
      },
      {
        property: "og:title",
        content: "DarkOps — Operational Intelligence for Dark-Store Networks",
      },
      {
        property: "og:description",
        content:
          "One operating layer for store health, case operations, fraud risk, and network performance.",
      },
    ],
  }),
  component: LandingPage,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

/* ─────────────────────────── Module definitions ───────────────────── */

const MODULES = [
  {
    id: "executive",
    icon: BarChart3,
    label: "Executive",
    tagline: "Network-level performance and critical operational signals.",
    detail:
      "PulseScore trend, SLA compliance, complaint volume, city-level roll-ups, and worst-performing stores — in a single consolidated view.",
    accent: "var(--primary)",
    accentBg: "var(--primary)",
  },
  {
    id: "operations",
    icon: Layers,
    label: "Operations",
    tagline: "Cases, SLA risk, workload, escalations, and service performance.",
    detail:
      "Complaint triage, priority queue, case assignment, escalation workflows, and resolution SLA tracking across the operations team.",
    accent: "var(--ok)",
    accentBg: "var(--ok)",
  },
  {
    id: "dark-stores",
    icon: Store,
    label: "Dark Stores",
    tagline: "Store health, PulseScore, equipment, incidents, and operational readiness.",
    detail:
      "Per-store PulseScore breakdown, equipment status, active work orders, incident log, and store-level complaint volume — drillable to individual stores.",
    accent: "var(--warn)",
    accentBg: "var(--warn)",
  },
  {
    id: "fraud",
    icon: ShieldAlert,
    label: "Fraud",
    tagline: "Risk review, suspicious activity, decisions, and fraud exposure.",
    detail:
      "AI-assisted fraud review queue with full claim context, confidence scores, and analyst decisioning. Closed audit trail for every decision.",
    accent: "var(--crit)",
    accentBg: "var(--crit)",
  },
] as const;

const PERSONAS = [
  {
    role: "Executive",
    icon: BarChart3,
    desc: "See network performance and critical exceptions without operational noise.",
  },
  {
    role: "Operations",
    icon: Layers,
    desc: "Resolve cases, manage SLA risk, and eliminate operational bottlenecks.",
  },
  {
    role: "Store Management",
    icon: Store,
    desc: "Run individual stores from health monitoring to incident resolution.",
  },
  {
    role: "Fraud",
    icon: ShieldAlert,
    desc: "Investigate risk signals and make defensible, auditable decisions.",
  },
  {
    role: "Customer",
    icon: Users,
    desc: "Track orders and resolve service issues through the customer experience.",
  },
] as const;

const SIGNAL_STEPS = [
  {
    id: "detect",
    label: "Detect",
    desc: "Surface store deterioration, SLA risk, fraud signals, and operational exceptions as they emerge — not after the fact.",
  },
  {
    id: "decide",
    label: "Decide",
    desc: "Give the right team the context needed to understand what is happening and what the exposure is.",
  },
  {
    id: "act",
    label: "Act",
    desc: "Turn operational signals into cases, escalations, investigations, and resolutions before they become customer impact.",
  },
] as const;

/* ─────────────────────────── Landing page ─────────────────────────── */

function LandingPage() {
  const modulesRef = useRef<HTMLElement>(null);

  const scrollToModules = (e: React.MouseEvent) => {
    e.preventDefault();
    modulesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="lp-root">
      <style>{LANDING_CSS}</style>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="lp-navbar" role="banner">
        <div className="lp-container lp-navbar-inner">
          <div className="lp-navbar-brand">
            {/* Logo mark */}
            <span className="lp-logo-mark" aria-hidden="true">
              <span className="lp-logo-dot" />
            </span>
            <span className="lp-wordmark">
              Dark<span className="lp-wordmark-accent">Ops</span>
            </span>
            <span className="lp-badge" aria-label="Operational Intelligence platform">
              Operational Intelligence
            </span>
          </div>

          <nav className="lp-navbar-right" aria-label="Primary navigation">
            <a href="#modules" onClick={scrollToModules} className="lp-nav-link">
              Platform
            </a>
            <ThemeToggle className="lp-theme-toggle" />
            <Link to="/login" className="lp-btn-primary" aria-label="Sign in to DarkOps">
              Sign in
              <ArrowRight className="lp-btn-icon" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        {/* ── Hero ─────────────────────────────────────────────────── */}
        <section className="lp-hero" aria-labelledby="hero-heading">
          <div className="lp-container lp-hero-inner">
            {/* Live eyebrow */}
            <div className="lp-eyebrow" role="status" aria-live="polite">
              <span className="lp-live-dot" aria-hidden="true" />
              <span className="lp-eyebrow-label">LIVE NETWORK</span>
              <span className="lp-eyebrow-sep" aria-hidden="true" />
              <span className="lp-eyebrow-meta">Bengaluru metro</span>
            </div>

            {/* Headline */}
            <h1 id="hero-heading" className="lp-hero-h1">
              Operational intelligence
              <br />
              <span className="lp-hero-accent">for dark-store networks.</span>
            </h1>

            {/* Supporting copy */}
            <p className="lp-hero-body">
              One operating layer for store health, case operations, fraud risk, and network
              performance.
            </p>

            {/* CTAs */}
            <div className="lp-hero-ctas">
              <Link
                to="/login"
                id="hero-signin-cta"
                className="lp-btn-primary lp-btn-lg"
                aria-label="Sign in to DarkOps platform"
              >
                Sign in to DarkOps
                <ArrowRight className="lp-btn-icon" aria-hidden="true" />
              </Link>
              <a
                href="#modules"
                id="hero-explore-cta"
                onClick={scrollToModules}
                className="lp-btn-ghost lp-btn-lg"
                aria-label="Explore the platform modules"
              >
                Explore the platform
              </a>
            </div>
          </div>
        </section>

        {/* ── From Complaint to Resolution ─────────────────────────────── */}
        <section className="lp-section lp-flow-section" aria-labelledby="flow-heading">
          <div className="lp-container">
            <div className="lp-section-header">
              <h2 id="flow-heading" className="lp-section-h2">
                From complaint to resolution.
              </h2>
              <p className="lp-section-sub">
                One operational layer that turns customer issues into network intelligence.
              </p>
            </div>

            <div className="lp-flow-steps">
              <div className="lp-flow-step">
                <div className="lp-flow-step-icon">
                  <Users className="lp-flow-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-flow-step-label">Customer complaint</h3>
                <p className="lp-flow-step-desc">
                  Issues are captured through the customer portal and automatically routed to
                  support.
                </p>
              </div>
              <div className="lp-flow-arrow" aria-hidden="true">
                →
              </div>
              <div className="lp-flow-step">
                <div className="lp-flow-step-icon">
                  <Layers className="lp-flow-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-flow-step-label">Support case</h3>
                <p className="lp-flow-step-desc">
                  Customer support triages, assigns, and escalates cases with full context.
                </p>
              </div>
              <div className="lp-flow-arrow" aria-hidden="true">
                →
              </div>
              <div className="lp-flow-step">
                <div className="lp-flow-step-icon">
                  <Store className="lp-flow-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-flow-step-label">Operational investigation</h3>
                <p className="lp-flow-step-desc">
                  Operations team investigates store-level issues and takes corrective action.
                </p>
              </div>
              <div className="lp-flow-arrow" aria-hidden="true">
                →
              </div>
              <div className="lp-flow-step">
                <div className="lp-flow-step-icon">
                  <AlertCircle className="lp-flow-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-flow-step-label">Store action</h3>
                <p className="lp-flow-step-desc">
                  Store managers execute work orders and resolve operational issues.
                </p>
              </div>
              <div className="lp-flow-arrow" aria-hidden="true">
                →
              </div>
              <div className="lp-flow-step">
                <div className="lp-flow-step-icon">
                  <ShieldAlert className="lp-flow-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-flow-step-label">Resolution</h3>
                <p className="lp-flow-step-desc">
                  Cases are resolved, customers are notified, and the loop closes.
                </p>
              </div>
              <div className="lp-flow-arrow" aria-hidden="true">
                →
              </div>
              <div className="lp-flow-step">
                <div className="lp-flow-step-icon">
                  <BarChart3 className="lp-flow-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-flow-step-label">Executive intelligence</h3>
                <p className="lp-flow-step-desc">
                  Network performance data informs strategic decisions and process improvements.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Value Pillars ─────────────────────────────────────────────── */}
        <section className="lp-section lp-pillars-section" aria-labelledby="pillars-heading">
          <div className="lp-container">
            <div className="lp-section-header">
              <h2 id="pillars-heading" className="lp-section-h2">
                Built for operational excellence.
              </h2>
            </div>

            <div className="lp-pillars-grid">
              <div className="lp-pillar-card">
                <div className="lp-pillar-icon-wrap">
                  <Layers className="lp-pillar-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-pillar-label">Customer → Operations</h3>
                <p className="lp-pillar-desc">
                  Complaints become actionable operational context with full traceability from issue
                  to resolution.
                </p>
              </div>
              <div className="lp-pillar-card">
                <div className="lp-pillar-icon-wrap">
                  <BarChart3 className="lp-pillar-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-pillar-label">Real-time intelligence</h3>
                <p className="lp-pillar-desc">
                  PulseScore, SLA compliance, backlog metrics, and store health in a single
                  operational platform.
                </p>
              </div>
              <div className="lp-pillar-card">
                <div className="lp-pillar-icon-wrap">
                  <ShieldAlert className="lp-pillar-icon" aria-hidden="true" />
                </div>
                <h3 className="lp-pillar-label">Secure by design</h3>
                <p className="lp-pillar-desc">
                  Role-based access control, row-level security, audit logging, and scoped customer
                  data isolation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Four Modules ─────────────────────────────────────────── */}
        <section
          id="modules"
          ref={modulesRef as React.RefObject<HTMLElement>}
          className="lp-section lp-modules-section"
          aria-labelledby="modules-heading"
        >
          <div className="lp-container">
            <div className="lp-section-header">
              <h2 id="modules-heading" className="lp-section-h2">
                Four modules. One platform.
              </h2>
              <p className="lp-section-sub">
                Every operational surface — consolidated under a single data layer.
              </p>
            </div>

            <div className="lp-modules-grid">
              {MODULES.map((mod) => {
                const Icon = mod.icon;
                return (
                  <article
                    key={mod.id}
                    className="lp-module-card"
                    style={{ "--mod-accent": mod.accent } as React.CSSProperties}
                  >
                    <div className="lp-module-icon-wrap">
                      <Icon className="lp-module-icon" aria-hidden="true" />
                    </div>
                    <h3 className="lp-module-label">{mod.label}</h3>
                    <p className="lp-module-tagline">{mod.tagline}</p>
                    <p className="lp-module-detail">{mod.detail}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Role-Based Views ──────────────────────────────────────── */}
        <section className="lp-section lp-personas-section" aria-labelledby="personas-heading">
          <div className="lp-container">
            <div className="lp-section-header">
              <h2 id="personas-heading" className="lp-section-h2">
                One network. Different operating views.
              </h2>
              <p className="lp-section-sub">
                DarkOps presents each team with the operational surface relevant to their role.
              </p>
            </div>

            <div className="lp-personas-grid">
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.role} className="lp-persona-card">
                    <div className="lp-persona-icon-wrap">
                      <Icon className="lp-persona-icon" aria-hidden="true" />
                    </div>
                    <div className="lp-persona-text">
                      <p className="lp-persona-role">{p.role}</p>
                      <p className="lp-persona-desc">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── From Signal to Action ─────────────────────────────────── */}
        <section className="lp-section lp-signal-section" aria-labelledby="signal-heading">
          <div className="lp-container">
            <div className="lp-section-header">
              <h2 id="signal-heading" className="lp-section-h2">
                From signal to action.
              </h2>
              <p className="lp-section-sub">
                Turn operational data into decisions your teams can execute.
              </p>
            </div>

            <div className="lp-signal-steps">
              {SIGNAL_STEPS.map((step, i) => (
                <div key={step.id} className="lp-signal-step">
                  <div className="lp-signal-step-num" aria-hidden="true">
                    0{i + 1}
                  </div>
                  <div className="lp-signal-step-content">
                    <h3 className="lp-signal-step-label">{step.label}</h3>
                    <p className="lp-signal-step-desc">{step.desc}</p>
                  </div>
                  {i < SIGNAL_STEPS.length - 1 && (
                    <div className="lp-signal-connector" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────── */}
        <section className="lp-section lp-cta-section" aria-labelledby="cta-heading">
          <div className="lp-container lp-cta-inner">
            <p className="lp-cta-eyebrow">See DarkOps in action.</p>
            <h2 id="cta-heading" className="lp-cta-h2">
              Sign in to explore the platform.
            </h2>
            <p className="lp-cta-body">
              Use the demo credentials on the login page to explore each role's operational
              experience.
            </p>
            <Link
              to="/login"
              id="final-signin-cta"
              className="lp-btn-primary lp-btn-lg"
              aria-label="Sign in to explore the DarkOps platform"
            >
              Sign in to DarkOps
              <ArrowRight className="lp-btn-icon" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container lp-footer-inner">
          <span className="lp-footer-copy">DarkOps · Deloitte Capstone 2026</span>
          <span className="lp-footer-status">
            <span className="lp-status-dot" aria-hidden="true" />
            All systems operational
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────── Scoped CSS ───────────────────────────── */
// Scoped to `.lp-*` classes to avoid polluting the global stylesheet.
// Uses existing design tokens from styles.css via var() references.

const LANDING_CSS = `
/* ── Root ── */
.lp-root {
  min-height: 100vh;
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-ui, "Inter", ui-sans-serif, system-ui, sans-serif);
  -webkit-font-smoothing: antialiased;
  display: flex;
  flex-direction: column;
}

/* ── Container ── */
.lp-container {
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 1.5rem;
}

@media (min-width: 768px) {
  .lp-container { padding-inline: 2rem; }
}
@media (min-width: 1280px) {
  .lp-container { padding-inline: 2.5rem; }
}

/* ── Navbar ── */
.lp-navbar {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--border);
  background-color: color-mix(in oklch, var(--background) 92%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.lp-navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 3.5rem;
}

.lp-navbar-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.lp-logo-mark {
  display: flex;
  width: 1.625rem;
  height: 1.625rem;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background-color: color-mix(in oklch, var(--primary) 15%, transparent);
  flex-shrink: 0;
}

.lp-logo-dot {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 3px;
  background-color: var(--primary);
}

.lp-wordmark {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--foreground);
}

.lp-wordmark-accent {
  color: var(--primary);
}

.lp-badge {
  display: none;
  font-size: 0.625rem;
  font-weight: 500;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.125rem 0.5rem;
  margin-left: 0.5rem;
}

@media (min-width: 640px) {
  .lp-badge { display: inline-block; }
}

.lp-navbar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.lp-nav-link {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  text-decoration: none;
  transition: color 0.15s ease;
}
.lp-nav-link:hover { color: var(--foreground); }
.lp-nav-link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ── Buttons ── */
.lp-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 4px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  font-size: 0.8125rem;
  font-weight: 500;
  padding: 0.375rem 0.875rem;
  text-decoration: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  white-space: nowrap;
  border: none;
  cursor: pointer;
}
.lp-btn-primary:hover {
  opacity: 0.88;
  transform: translateY(-1px);
}
.lp-btn-primary:active { transform: translateY(0); opacity: 1; }
.lp-btn-primary:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
  border-radius: 4px;
}

.lp-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  border-radius: 4px;
  border: 1px solid var(--border);
  background-color: var(--surface);
  color: var(--muted-foreground);
  font-size: 0.8125rem;
  font-weight: 400;
  padding: 0.375rem 0.875rem;
  text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  white-space: nowrap;
  cursor: pointer;
}
.lp-btn-ghost:hover {
  color: var(--foreground);
  border-color: color-mix(in oklch, var(--border) 160%, transparent);
  background-color: var(--surface-2);
}
.lp-btn-ghost:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
  border-radius: 4px;
}

.lp-btn-lg {
  font-size: 0.9375rem;
  padding: 0.6875rem 1.375rem;
}

.lp-btn-icon {
  width: 0.875rem;
  height: 0.875rem;
  transition: transform 0.15s ease;
}
.lp-btn-primary:hover .lp-btn-icon {
  transform: translateX(2px);
}

/* ── Live dot ── */
.lp-live-dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background-color: var(--ok);
  animation: lp-pulse 2.4s ease-in-out infinite;
  flex-shrink: 0;
}
.lp-live-dot-sm {
  width: 0.3125rem;
  height: 0.3125rem;
}

@keyframes lp-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Label caps ── */
.lp-label-caps {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  line-height: 1rem;
}

/* ── Hero ── */
.lp-hero {
  padding-block: 3rem 2.25rem;
}

@media (min-width: 768px) {
  .lp-hero { padding-block: 4rem 3rem; }
}

.lp-hero-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1.125rem;
  max-width: 760px;
}

/* Eyebrow */
.lp-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border);
  background-color: var(--surface);
  border-radius: 999px;
  padding: 0.25rem 0.75rem;
}

.lp-eyebrow-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ok);
}

.lp-eyebrow-sep {
  width: 1px;
  height: 0.75rem;
  background-color: var(--border);
}

.lp-eyebrow-meta {
  font-size: 0.6875rem;
  font-weight: 400;
  color: var(--muted-foreground);
  letter-spacing: 0.02em;
}

.lp-eyebrow-skeleton {
  display: inline-block;
  width: 10rem;
  height: 0.6875rem;
  border-radius: 3px;
  background-color: var(--surface-3);
  animation: lp-shimmer 1.4s ease-in-out infinite;
}

/* Headline */
.lp-hero-h1 {
  font-size: clamp(2.5rem, 5.5vw, 4rem);
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.08;
  color: var(--foreground);
  margin: 0;
}

.lp-hero-accent {
  color: var(--primary);
}

/* Supporting copy */
.lp-hero-body {
  font-size: 1.0625rem;
  line-height: 1.6;
  color: var(--muted-foreground);
  max-width: 52ch;
  margin: 0;
}

@media (min-width: 768px) {
  .lp-hero-body { font-size: 1.125rem; }
}

/* CTAs */
.lp-hero-ctas {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.25rem;
}

/* ── Section shared ── */
.lp-section {
  padding-block: 2.5rem;
  border-top: 1px solid var(--border);
}

@media (min-width: 768px) {
  .lp-section { padding-block: 3rem; }
}

.lp-section-header {
  margin-bottom: 1.5rem;
  max-width: 620px;
}

.lp-section-h2 {
  font-size: clamp(1.375rem, 2.5vw, 1.875rem);
  font-weight: 600;
  letter-spacing: -0.025em;
  color: var(--foreground);
  margin: 0 0 0.4rem;
}

.lp-section-sub {
  font-size: 0.9375rem;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0;
}

/* ── Modules ── */
.lp-modules-section {
  background-color: color-mix(in oklch, var(--surface) 30%, transparent);
}

.lp-modules-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .lp-modules-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .lp-modules-grid { grid-template-columns: repeat(4, 1fr); }
}

.lp-module-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background-color: var(--surface);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: border-color 0.2s ease, transform 0.2s ease, background-color 0.2s ease;
  position: relative;
  overflow: hidden;
}

.lp-module-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 6px;
  border-top: 2px solid var(--mod-accent, var(--primary));
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.lp-module-card:hover {
  border-color: color-mix(in oklch, var(--border) 160%, transparent);
  background-color: var(--surface-2);
  transform: translateY(-2px);
}

.lp-module-card:hover::before {
  opacity: 1;
}

.lp-module-card:hover .lp-module-icon-wrap {
  transform: translateY(-2px);
}

.lp-module-icon-wrap {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background-color: color-mix(in oklch, var(--mod-accent, var(--primary)) 12%, transparent);
  margin-bottom: 0.875rem;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.lp-module-icon {
  width: 1rem;
  height: 1rem;
  color: var(--mod-accent, var(--primary));
}

.lp-module-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0 0 0.375rem;
  letter-spacing: -0.015em;
}

.lp-module-tagline {
  font-size: 0.875rem;
  color: var(--foreground);
  margin: 0 0 0.625rem;
  line-height: 1.5;
  font-weight: 400;
}

.lp-module-detail {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0;
}

/* ── Personas ── */
.lp-personas-grid {
  display: grid;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--surface);
}

@media (min-width: 640px) {
  .lp-personas-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 1024px) {
  .lp-personas-grid { grid-template-columns: repeat(5, 1fr); }
}

.lp-persona-card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1.125rem 1.25rem;
  border-bottom: 1px solid var(--border);
  border-right: 0;
  transition: background-color 0.15s ease;
}

@media (min-width: 640px) {
  .lp-persona-card {
    flex-direction: column;
    border-right: 1px solid var(--border);
  }
  .lp-persona-card:nth-child(2n) { border-right: 0; }
}

@media (min-width: 1024px) {
  .lp-persona-card { border-bottom: 0; }
  .lp-persona-card:nth-child(2n) { border-right: 1px solid var(--border); }
  .lp-persona-card:last-child { border-right: 0; }
}

.lp-persona-card:hover {
  background-color: var(--surface-2);
}

.lp-persona-icon-wrap {
  display: flex;
  width: 1.75rem;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background-color: var(--surface-3);
  flex-shrink: 0;
}

.lp-persona-icon {
  width: 0.875rem;
  height: 0.875rem;
  color: var(--muted-foreground);
}

.lp-persona-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.lp-persona-role {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  letter-spacing: -0.01em;
}

.lp-persona-desc {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  line-height: 1.55;
  margin: 0;
}

/* ── Signal to Action ── */
.lp-signal-section {
  background-color: color-mix(in oklch, var(--surface) 25%, transparent);
}

.lp-signal-steps {
  display: grid;
  gap: 0;
  grid-template-columns: 1fr;
  position: relative;
}

@media (min-width: 768px) {
  .lp-signal-steps {
    grid-template-columns: repeat(3, 1fr);
    gap: 0;
  }
}

.lp-signal-step {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1.25rem 1.25rem 1.25rem 0;
  border-bottom: 1px solid var(--border);
  position: relative;
}

.lp-signal-step:last-child {
  border-bottom: 0;
}

@media (min-width: 768px) {
  .lp-signal-step {
    padding: 0 2rem 0 0;
    border-bottom: 0;
    border-right: 1px solid var(--border);
  }
  .lp-signal-step:last-child {
    border-right: 0;
    padding-right: 0;
  }
  .lp-signal-step:not(:first-child) {
    padding-left: 2rem;
  }
}

.lp-signal-step-num {
  font-family: var(--font-data, "JetBrains Mono", ui-monospace, monospace);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--primary);
  opacity: 0.7;
}

.lp-signal-step-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.lp-signal-step-label {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--foreground);
  letter-spacing: -0.015em;
  margin: 0;
}

.lp-signal-step-desc {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  line-height: 1.65;
  margin: 0;
}

/* ── Flow section ── */
.lp-flow-section {
  background-color: color-mix(in oklch, var(--surface) 30%, transparent);
}

.lp-flow-steps {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .lp-flow-steps {
    flex-direction: row;
    align-items: flex-start;
    gap: 0;
  }
}

.lp-flow-step {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.lp-flow-step-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  flex-shrink: 0;
}

.lp-flow-icon {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--primary);
}

.lp-flow-step-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--foreground);
  letter-spacing: -0.01em;
  margin: 0;
  line-height: 1.3;
}

.lp-flow-step-desc {
  font-size: 0.8125rem;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0;
}

.lp-flow-arrow {
  display: none;
  font-size: 1.25rem;
  color: var(--border);
  align-self: center;
  flex-shrink: 0;
}

@media (min-width: 768px) {
  .lp-flow-arrow {
    display: block;
    padding: 0 0.5rem;
  }
}

/* ── Pillars section ── */
.lp-pillars-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
}

@media (min-width: 640px) {
  .lp-pillars-grid { grid-template-columns: repeat(3, 1fr); }
}

.lp-pillar-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  background-color: var(--surface);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.lp-pillar-card:hover {
  border-color: color-mix(in oklch, var(--border) 160%, transparent);
  background-color: var(--surface-2);
}

.lp-pillar-icon-wrap {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  background-color: color-mix(in oklch, var(--primary) 12%, transparent);
  flex-shrink: 0;
}

.lp-pillar-icon {
  width: 1rem;
  height: 1rem;
  color: var(--primary);
}

.lp-pillar-label {
  font-size: 1rem;
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
  letter-spacing: -0.015em;
}

.lp-pillar-desc {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0;
}

/* ── Final CTA ── */
.lp-cta-section {
  text-align: center;
}

.lp-cta-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 520px;
}

.lp-cta-eyebrow {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: var(--primary);
  margin: 0;
}

.lp-cta-h2 {
  font-size: clamp(1.5rem, 2.8vw, 2.125rem);
  font-weight: 600;
  letter-spacing: -0.025em;
  color: var(--foreground);
  margin: 0;
  line-height: 1.15;
}

.lp-cta-body {
  font-size: 0.9375rem;
  color: var(--muted-foreground);
  line-height: 1.6;
  margin: 0;
}

/* ── Footer ── */
.lp-footer {
  border-top: 1px solid var(--border);
  padding-block: 1.25rem;
  margin-top: auto;
}

.lp-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.lp-footer-copy {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.lp-footer-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.lp-status-dot {
  display: inline-block;
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background-color: var(--ok);
  flex-shrink: 0;
}

/* ── Shimmer animation ── */
@keyframes lp-shimmer {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.25; }
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .lp-live-dot,
  .lp-eyebrow-skeleton,
  .lp-metric-skeleton { animation: none !important; }
  .lp-btn-primary:hover,
  .lp-module-card:hover,
  .lp-module-card:hover .lp-module-icon-wrap { transform: none !important; }
}

/* ── Focus styles ── */
.lp-root *:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 3px;
  border-radius: 3px;
}

/* ── Mobile layout adjustments ── */
@media (max-width: 640px) {
  .lp-hero { padding-block: 2rem 1.75rem; }
  .lp-hero-ctas { flex-direction: column; align-items: flex-start; }
  .lp-section { padding-block: 2rem; }
  .lp-cta-inner { align-items: flex-start; text-align: left; }
  .lp-signal-connector { display: none; }
}

/* ── No horizontal overflow ── */
.lp-root,
.lp-root * {
  box-sizing: border-box;
  max-width: 100%;
}
`;
