import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight, Wrench } from "lucide-react";
import { Breadcrumbs, PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  PriorityBadge,
  StatusBadge,
} from "@/components/ops/primitives";
import { useStoreDetail } from "@/hooks/useStoreDetail";
import { useCases } from "@/hooks/useCases";
import { useExecutive } from "@/hooks/useExecutive";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

export const Route = createFileRoute("/dark-stores/$id/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id} store operations — DarkOps` },
      {
        name: "description",
        content: `Dark store ${params.id}: PulseScore breakdown, equipment failures, inventory issues, work orders and live complaints.`,
      },
      { property: "og:title", content: `${params.id} store operations — DarkOps` },
      {
        property: "og:description",
        content: "Store-level operational dashboard with explainable PulseScore.",
      },
    ],
  }),
  component: StoreDashboard,
});

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
};

const ASSETS = [
  { id: "FRZ-08", name: "Walk-in freezer Bay 2" },
  { id: "CHL-04", name: "Dairy chiller Aisle 4" },
  { id: "CNV-02", name: "Pick conveyor line 2" },
  { id: "SCN-11", name: "Handheld scanner #11" },
  { id: "WGH-01", name: "Weighing station 1" },
];

const CATEGORIES = [
  "Cold chain / quality",
  "Missing items",
  "Late delivery",
  "Wrong item",
  "Damaged packaging",
];

function StoreDashboard() {
  const { id } = Route.useParams();
  const { data: detailData, isLoading, error } = useStoreDetail(id);
  const { data: casesData } = useCases();
  const networkAvgPulse = '—'; // Executive data not needed on store detail page

  const localCases = useMemo(() => {
    if (!casesData?.cases || !detailData) return [];
    return casesData.cases.filter((c) => c.storeId === detailData.store.id).slice(0, 5);
  }, [casesData, detailData]);

  if (isLoading) return <div className="p-8">Loading store dashboard...</div>;
  if (error) {
    console.error('Store detail error:', error);
    return (
      <div className="p-8">
        <div className="text-crit">Failed to load store: {error.message || 'Unknown error'}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Store ID: {id}
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!detailData) return <div className="p-8 text-crit">Store data not available.</div>;

  const { store, series } = detailData;

  const b = store.breakdown;
  const factors = [
    { label: "Equipment", value: b.equipment },
    { label: "SLA", value: b.sla },
    { label: "Refunds", value: b.refunds },
    { label: "Delivery", value: b.delivery },
    { label: "Picker", value: b.picker },
    { label: "Inventory", value: b.inventory },
  ];
  const totalDeduction = factors.reduce((a, f) => a + f.value, 0);

  const workOrders = ASSETS.slice(0, 4).map((a, i) => ({
    id: `WO-${77412 - i * 14}`,
    priority: (["P1", "P2", "P3", "P2"] as const)[i]!,
    status: ["In progress", "Awaiting parts", "Assigned", "Open"][i]!,
    asset: a,
    due: ["10:12", "18:40", "09:05", "21:15"][i]!,
  }));

  const repairs = ASSETS.slice(0, 4).map((a, i) => ({
    ...a,
    waiting: ["6h 04m", "1d 3h", "1d 9h", "3d 2h"][i]!,
    tone: (["crit", "warn", "warn", "neutral"] as const)[i]!,
  }));

  const complaints = localCases.length ? localCases : [];

  const categoryCounts = CATEGORIES.map((label, i) => ({
    label,
    count: Math.max(4, Math.round((38 - i * 6) * 0.7)),
  }));
  const maxCount = Math.max(...categoryCounts.map((c) => c.count));

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Executive", to: "/executive" },
          { label: "Dark store network", to: "/dark-stores" },
          { label: `${store.city} / ${store.id}` },
        ]}
      />

      <Panel className="mb-3">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{store.name}</h1>
              <span className="num rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {store.id}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {store.city} · Manager: {store.manager} · {store.pickers} pickers on shift ·{" "}
              {store.riders} riders assigned
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Chip tone={store.sla < 70 ? "crit" : store.sla < 90 ? "warn" : "ok"}>
                SLA {store.sla}%
              </Chip>
              <Chip tone={store.refundRate > 8 ? "crit" : store.refundRate > 5 ? "warn" : "ok"}>
                Refunds {store.refundRate}%
              </Chip>
              <Chip tone="neutral">Avg resolution {store.avgResolutionMins}m</Chip>
            </div>
          </div>
          <LiveTag seconds={13} />
        </div>

        <div className="mt-4 px-5 pb-5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
            <span className="num text-muted-foreground">100 baseline</span>
            {factors.map((f) => (
              <span key={f.label} className="flex items-baseline gap-1">
                <span className="num font-medium text-crit">-{f.value}</span>
                <span className="text-muted-foreground">{f.label}</span>
              </span>
            ))}
            <span className="text-muted-foreground">=</span>
            <span
              className={cn(
                "num text-3xl leading-none font-semibold",
                store.pulse < 60 ? "text-crit" : store.pulse < 80 ? "text-warn" : "text-ok",
              )}
            >
              {store.pulse}
            </span>
            <span className="num text-xs text-muted-foreground">/100 PulseScore</span>
            <Link
              to="/dark-stores/$id/pulse"
              params={{ id: store.id }}
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open PulseScore detail <ChevronRight className="size-3" />
            </Link>
          </div>

          <div className="mt-3 flex h-2 w-full overflow-hidden rounded-sm bg-surface-3">
            <div
              className="bg-ok"
              style={{ width: `${Math.max(0, 100 - totalDeduction)}%` }}
              aria-hidden
            />
            {factors.map((f, i) => (
              <div
                key={f.label}
                className={i % 2 === 0 ? "bg-crit/85" : "bg-crit/60"}
                style={{ width: `${f.value}%` }}
                aria-hidden
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            PulseScore is not a black box: it starts at 100 and subtracts equipment downtime, SLA
            misses, refund rate, delivery and picker delays, and inventory accuracy. Fix a driver and
            the score moves.
          </p>
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="PulseScore"
          value={store.pulse}
          unit="/100"
          tone={store.pulse < 60 ? "crit" : store.pulse < 80 ? "warn" : "ok"}
          footnote={`network avg ${networkAvgPulse}`}
        />
        <KpiCard
          label="Equipment failures"
          value={store.equipmentFailures14d}
          unit="last 14d"
          tone="crit"
          footnote={`network avg 3 · ${workOrders.length} work orders open`}
        />
        <KpiCard
          label="Inventory issues"
          value={store.inventoryIssues}
          unit="stockouts + mismatches"
          tone="warn"
          footnote="today · network avg 6"
        />
        <KpiCard
          label="Delivery delays"
          value={store.deliveryDelays}
          unit="orders > 20 min"
          tone="warn"
          footnote="today · network avg 28"
        />
        <KpiCard
          label="Picker delay"
          value={`${store.pickerDelayMins}m`}
          tone={store.pickerDelayMins > 3 ? "crit" : "warn"}
          footnote="network avg 2.1m · target 2.5m"
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Equipment failures — 14 days"
            subtitle="Failures and downtime hours; cold chain drives quality complaints."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={series} margin={{ left: -22, right: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={2} />
                <YAxis {...axis} width={40} />
                <RTooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="failures" name="Failures" fill="var(--crit)" maxBarSize={12} />
                <Bar dataKey="downtime" name="Downtime (h)" fill="var(--warn)" maxBarSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Inventory issues — 14 days"
            subtitle="Stockouts cause substitutions; mismatches cause missing-item claims."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={series} margin={{ left: -22, right: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} interval={2} />
                <YAxis {...axis} width={40} />
                <RTooltip contentStyle={tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="stockouts"
                  name="Stockouts"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="mismatches"
                  name="Mismatches"
                  stroke="var(--warn)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Panel>
          <PanelHeader
            title="Open work orders"
            subtitle={`${workOrders.length} open · field service records raised against store assets.`}
          />
          <ul>
            {workOrders.map((w) => (
              <li
                key={w.id}
                className="row-hover flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0"
              >
                <Wrench className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="num text-[13px] font-medium">{w.id}</span>
                    <PriorityBadge priority={w.priority} />
                    <span className="text-xs text-muted-foreground">{w.status}</span>
                  </div>
                  <p className="num mt-0.5 text-xs text-muted-foreground">
                    {w.asset.id} · {w.asset.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">SLA due</p>
                  <p className="num text-[13px]">{w.due}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Pending repairs" subtitle="Assets waiting on a technician." />
          <ul>
            {repairs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3 last:border-0"
              >
                <div>
                  <p className="num text-[13px] font-medium">{r.id}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.name}</p>
                </div>
                <Chip tone={r.tone}>{r.waiting}</Chip>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Top complaint categories" subtitle="Last 7 days at this store." />
          <ul className="space-y-3 p-4">
            {categoryCounts.map((c) => (
              <li key={c.label}>
                <div className="flex items-center justify-between text-[13px]">
                  <span>{c.label}</span>
                  <span className="num text-muted-foreground">{c.count}</span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-sm bg-surface-3">
                  <div
                    className="h-1.5 rounded-sm bg-primary"
                    style={{ width: `${(c.count / maxCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
