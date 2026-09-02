import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Breadcrumbs, PageHeader } from "@/components/layout/page-header";
import { Chip, KpiCard, Panel, PanelHeader } from "@/components/ops/primitives";
import { useStoreDetail } from "@/hooks/useStoreDetail";
import { useExecutive } from "@/hooks/useExecutive";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dark-stores/$id/pulse")({
  head: ({ params }) => ({
    meta: [
      { title: `PulseScore breakdown ${params.id} — DarkOps` },
      {
        name: "description",
        content: `Explainable PulseScore for dark store ${params.id}: every deduction, its evidence and the recommended fix.`,
      },
      { property: "og:title", content: `PulseScore breakdown ${params.id} — DarkOps` },
      {
        property: "og:description",
        content: "Every PulseScore deduction with evidence and remediation.",
      },
    ],
  }),
  component: PulseDetail,
});

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

const COPY: Record<
  string,
  { title: string; weight: string; how: string; evidence: (v: number) => string; fix: string }
> = {
  equipment: {
    title: "Equipment reliability",
    weight: "up to -25",
    how: "Failures and downtime hours on cold-chain and pick assets over a rolling 14 days.",
    evidence: (v) => `${v} points lost · freezer and chiller downtime in the pick window`,
    fix: "Raise a P1 work order for the offline asset and divert affected SKUs to the nearest store.",
  },
  sla: {
    title: "SLA compliance",
    weight: "up to -25",
    how: "Share of complaints resolved inside the priority-tier SLA window.",
    evidence: (v) => `${v} points lost · breaches concentrated in the evening peak`,
    fix: "Add an evening-peak agent shift and auto-assign P1 cases on arrival.",
  },
  refunds: {
    title: "Refund rate",
    weight: "up to -20",
    how: "Refund value as a share of store GMV against a 4.0% target.",
    evidence: (v) => `${v} points lost · refund rate above network target`,
    fix: "Route high-value claims through risk review before auto-approval.",
  },
  delivery: {
    title: "Delivery performance",
    weight: "up to -15",
    how: "Orders delivered beyond the promised 20 minute window.",
    evidence: (v) => `${v} points lost · rider dwell at handover`,
    fix: "Rebalance rider rosters for the 19:00–22:00 block.",
  },
  picker: {
    title: "Picker throughput",
    weight: "up to -10",
    how: "Average pick time per order against a 2.5 minute target.",
    evidence: (v) => `${v} points lost · pick time above target`,
    fix: "Re-slot fast-moving SKUs to the front aisles and add one picker per shift.",
  },
  inventory: {
    title: "Inventory accuracy",
    weight: "up to -10",
    how: "Stockouts and system-to-shelf mismatches found at pick time.",
    evidence: (v) => `${v} points lost · mismatches causing substitutions`,
    fix: "Run a cycle count on the affected aisles before the morning peak.",
  },
};

function PulseDetail() {
  const { id } = Route.useParams();
  const { data: detailData, isLoading, error } = useStoreDetail(id);
  const { data: execData } = useExecutive();
  const networkAvgPulse = execData?.network?.avgPulse ?? '—';

  if (isLoading) return <div className="p-8">Loading pulse detail...</div>;
  if (error || !detailData) return <div className="p-8 text-crit">Failed to load pulse detail.</div>;

  const { store, trend } = detailData;
  const b = store.breakdown;
  const factors = (Object.keys(COPY) as Array<keyof typeof b>).map((key) => ({
    key,
    value: b[key],
    ...COPY[key]!,
  }));
  const total = factors.reduce((a, f) => a + f.value, 0);
  const worst = [...factors].sort((a, b2) => b2.value - a.value)[0]!;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Dark store network", to: "/dark-stores" },
          { label: store.id, to: "/dark-stores/$id", params: { id: store.id } },
          { label: "PulseScore" },
        ]}
      />

      <PageHeader
        title="PulseScore breakdown"
        subtitle={`${store.name} · ${store.id} · ${store.city} · explainable store health, updated every 5 minutes`}
        right={
          <>
            <Chip tone={store.pulse < 60 ? "crit" : store.pulse < 80 ? "warn" : "ok"}>
              PulseScore {store.pulse}/100
            </Chip>
            <Chip tone={store.pulse < store.prevPulse ? "crit" : "ok"}>
              {store.pulse - store.prevPulse >= 0 ? "+" : ""}
              {store.pulse - store.prevPulse} vs last week
            </Chip>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Current PulseScore"
          value={store.pulse}
          unit="/100"
          tone={store.pulse < 60 ? "crit" : store.pulse < 80 ? "warn" : "ok"}
          footnote={`network avg ${networkAvgPulse}`}
        />
        <KpiCard label="Total deduction" value={`-${total}`} tone="crit" footnote="from 100 baseline" />
        <KpiCard
          label="Largest driver"
          value={worst.title}
          tone="warn"
          footnote={`-${worst.value} points`}
        />
        <KpiCard
          label="Recoverable"
          value={`+${Math.round(worst.value * 0.7)}`}
          tone="ok"
          footnote="if the top driver is cleared"
        />
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="PulseScore — last 30 days"
          subtitle="Score decays as drivers accumulate; recovery follows remediation."
        />
        <div className="p-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend} margin={{ left: -22, right: 8 }}>
              <defs>
                <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" {...axis} interval={4} />
              <YAxis {...axis} width={40} domain={[0, 100]} />
              <RTooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="score"
                name="PulseScore"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#pulseFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel className="mt-3">
        <PanelHeader
          title="Deduction ledger"
          subtitle="Each driver, how it is measured, what it cost this store and what fixes it."
        />
        <ul>
          {[...factors]
            .sort((a, b2) => b2.value - a.value)
            .map((f) => (
              <li key={f.key} className="border-b border-border/70 px-4 py-4 last:border-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[13px] font-medium">{f.title}</span>
                    <span className="num text-[11px] text-muted-foreground">{f.weight}</span>
                  </div>
                  <span
                    className={cn(
                      "num text-sm font-semibold",
                      f.value >= 15 ? "text-crit" : f.value >= 8 ? "text-warn" : "text-muted-foreground",
                    )}
                  >
                    -{f.value} pts
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-sm bg-surface-3">
                  <div
                    className={cn(
                      "h-1.5 rounded-sm",
                      f.value >= 15 ? "bg-crit" : f.value >= 8 ? "bg-warn" : "bg-muted-foreground/60",
                    )}
                    style={{ width: `${Math.min(100, f.value * 4)}%` }}
                  />
                </div>
                <div className="mt-2.5 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                  <p>
                    <span className="label-caps block">How it is measured</span>
                    {f.how}
                  </p>
                  <p>
                    <span className="label-caps block">Evidence</span>
                    {f.evidence(f.value)}
                  </p>
                  <p>
                    <span className="label-caps block">Recommended fix</span>
                    {f.fix}
                  </p>
                </div>
              </li>
            ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="num">
            100 baseline − {total} deductions = {store.pulse} PulseScore
          </span>
          <Link
            to="/dark-stores/$id"
            params={{ id: store.id }}
            className="text-primary hover:underline"
          >
            Back to store operations
          </Link>
        </div>
      </Panel>
    </>
  );
}
