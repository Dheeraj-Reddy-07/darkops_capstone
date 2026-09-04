import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, Filter } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
} from "@/components/ops/primitives";
import { HeatmapLegend, StoreHeatmap } from "@/components/ops/heatmap";
import { useExecutive } from "@/hooks/useExecutive";
import { useStores } from "@/hooks/useStores";
import { num, cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "@tanstack/react-router";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/executive/")({
  head: () => ({
    meta: [
      { title: "Executive overview - DarkOps" },
      {
        name: "description",
        content:
          "Network PulseScore, SLA compliance, refund rate and critical dark stores across 200 stores in 14 Indian cities.",
      },
      { property: "og:title", content: "Executive overview - DarkOps" },
      {
        property: "og:description",
        content: "Command center view of dark store network health and complaint resolution.",
      },
    ],
  }),
  component: ExecutiveOverview,
  preload: false,
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
  color: "var(--popover-foreground)",
};

function PulseDial({ score }: { score: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative size-24">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--warn)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="num text-2xl leading-none font-semibold text-warn">{score}</span>
        <span className="num text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

function ExecutiveOverview() {
  const [timeFilter, setTimeFilter] = useState('30d');
  const location = useLocation();
  const isOnExecutiveRoute = location.pathname === '/executive' || location.pathname === '/executive/';
  
  // Don't render if not on executive route
  if (!isOnExecutiveRoute) {
    return null;
  }
  
  return <ExecutiveOverviewContent timeFilter={timeFilter} setTimeFilter={setTimeFilter} />;
}

function ExecutiveOverviewContent({ timeFilter, setTimeFilter }: { timeFilter: string; setTimeFilter: (val: string) => void }) {
  const { data: userProfile } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      return profile as any;
    },
  });
  
  const userRole = userProfile?.role as string;
  const canAccessExecutive = ['PLATFORM_ADMIN', 'EXECUTIVE'].includes(userRole);
  const canAccessStores = ['PLATFORM_ADMIN', 'EXECUTIVE', 'OPERATIONS', 'STORE_MANAGER'].includes(userRole);
  
  // Only fetch executive data if user has permission
  const { data: execData, isLoading: execLoading } = useExecutive(canAccessExecutive);
  const { data: storesData, isLoading: storesLoading } = useStores(canAccessExecutive);

  if (!canAccessExecutive) {
    return <div className="p-8 text-center text-muted-foreground">You don't have permission to view executive metrics.</div>;
  }

  if (execLoading || storesLoading) return <div className="p-8">Loading executive metrics...</div>;
  if (!execData || !storesData) return <div className="p-8 text-crit">Failed to load metrics.</div>;

  const { kpis: EXEC_KPIS, network: NETWORK, backlogDelta: BACKLOG_DELTA, volumeSeries: VOLUME_SERIES, redAlerts: RED_ALERTS, cityStats: CITY_STATS } = execData;
  const { worstStores: WORST_STORES, kpis: STORE_KPIS } = storesData;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-crit/40 bg-crit-soft/25 px-4 py-3">
        <AlertTriangle className="size-4 text-crit" />
        <p className="text-[13px] font-medium">
          Network health declining - backlog up {EXEC_KPIS.openComplaintsDelta}%,{" "}
          {NETWORK.criticalStores} stores need intervention, {EXEC_KPIS.slaBreached} SLA breaches today.
        </p>
      </div>

      <PageHeader
        title="Executive overview"
        subtitle={`${NETWORK.storeCount} dark stores · ${NETWORK.cityCount} cities · ${num(EXEC_KPIS.complaints24h)} complaints in last 24h`}
        right={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="size-3.5" />
                  {timeFilter === '7d' ? '7 days' : timeFilter === '30d' ? '30 days' : '90 days'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTimeFilter('7d')}>7 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeFilter('30d')}>30 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeFilter('90d')}>90 days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <LiveTag seconds={15} />
            <span className="flex items-center gap-1.5 rounded-sm border border-crit/40 bg-crit-soft/25 px-2.5 py-1 text-xs text-crit">
              <AlertTriangle className="size-3.5" />
              {NETWORK.criticalStores} stores need intervention · PulseScore &lt; 60
            </span>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Network PulseScore"
          emphasis
          footnote="pts vs prior 30d · headline metric"
          delta={`${Math.abs(EXEC_KPIS.pulseDelta)}%`}
          deltaTone="ok"
        >
          <div className="mt-1 flex items-center gap-3">
            <PulseDial score={EXEC_KPIS.networkPulse} />
          </div>
        </KpiCard>
        <KpiCard
          label="Open complaints"
          value={num(EXEC_KPIS.openComplaints)}
          delta={`${EXEC_KPIS.openComplaintsDelta}%`}
          footnote="vs prior 30d"
        />
        <KpiCard
          label="SLA compliance"
          value={STORE_KPIS.avgSla}
          unit="%"
          tone="warn"
          delta={`${Math.abs(EXEC_KPIS.slaDelta)}%`}
          footnote={`target ${EXEC_KPIS.slaTarget}%`}
        />
        <KpiCard
          label="Avg resolution time"
          value={`${STORE_KPIS.avgResolution}m`}
          delta={`${Math.abs(EXEC_KPIS.resolutionDelta)}%`}
          deltaTone="ok"
          footnote={`target ${EXEC_KPIS.resolutionTarget}m`}
        />
        <KpiCard
          label="Refund rate"
          value={STORE_KPIS.avgRefundRate}
          unit="% of orders"
          delta={`${EXEC_KPIS.refundDelta}%`}
          footnote={`target ${EXEC_KPIS.refundTarget}%`}
        />
        <KpiCard
          label="Critical stores"
          value={NETWORK.criticalStores}
          unit={`of ${NETWORK.storeCount}`}
          tone="crit"
          delta={`${EXEC_KPIS.criticalDelta}%`}
          footnote="PulseScore < 60, no active fix"
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_400px]">
        <Panel>
          <PanelHeader
            title="Complaint volume vs resolved - 30 days"
            subtitle="Intake is outpacing resolution since 21 Aug; backlog is accumulating."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={286}>
              <AreaChart data={VOLUME_SERIES} margin={{ left: -18, right: 8, top: 6 }}>
                <defs>
                  <linearGradient id="raised" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" interval={4} {...axis} />
                <YAxis {...axis} width={52} />
                <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--popover-foreground)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="square" iconSize={9} />
                <Area
                  type="monotone"
                  dataKey="raised"
                  name="Complaints raised"
                  stroke="var(--chart-1)"
                  fill="url(#raised)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="resolved"
                  name="Complaints resolved"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Red alerts"
            subtitle="Needs a leadership decision."
          />
          <div className="max-h-64 overflow-y-auto">
            <ul>
              {(RED_ALERTS || []).map((a: any) => (
                <li key={a.id}>
                  {canAccessStores && a.storeId ? (
                    <Link
                      to="/dark-stores/$id"
                      params={{ id: a.storeId }}
                      className="row-hover flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-0"
                    >
                      <span
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.severity === "crit" ? "bg-crit" : "bg-warn"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="truncate text-[13px] font-medium">{a.title}</p>
                          <span className="num text-[11px] text-muted-foreground">{a.id}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.detail}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{a.ago}</p>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-0 opacity-60">
                      <span
                        className={`mt-1.5 size-1.5 shrink-0 rounded-full ${a.severity === "crit" ? "bg-crit" : "bg-warn"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="truncate text-[13px] font-medium">{a.title}</p>
                          <span className="num text-[11px] text-muted-foreground">{a.id}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.detail}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{a.ago}</p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_400px]">
        <Panel>
          <PanelHeader
            title="City-wise complaints & SLA"
            subtitle="Where to send regional ops leadership this week."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={288}>
              <BarChart data={(CITY_STATS || []).slice(0, 10)} margin={{ left: -18, right: 8, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="city" {...axis} interval={0} angle={0} height={40} />
                <YAxis {...axis} width={52} />
                <RTooltip contentStyle={tooltipStyle} itemStyle={{ color: "var(--popover-foreground)" }} cursor={{ fill: "var(--surface-2)" }} />
                <Bar dataKey="complaints" name="Complaints" fill="var(--chart-1)" maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Top 5 worst stores"
            subtitle="Lowest PulseScore - click to open the store's dashboard."
          />
          <ul>
            {WORST_STORES.map((s) => (
              <li key={s.id}>
                {canAccessStores && s.id ? (
                  <Link
                    to="/dark-stores/$id"
                    params={{ id: s.id }}
                    className="row-hover flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{s.name}</p>
                      <p className="num mt-0.5 truncate text-[11px] text-muted-foreground">
                        {s.id} · {s.city} · SLA {s.sla}% · refunds {s.refundRate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-lg leading-none font-semibold text-crit">{s.pulse}</p>
                      <p className="num mt-1 text-[11px] text-crit">
                        ↘ {Math.max(1, s.prevPulse - s.pulse)} this week
                      </p>
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-0 opacity-60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{s.name}</p>
                      <p className="num mt-0.5 truncate text-[11px] text-muted-foreground">
                        {s.id} · {s.city} · SLA {s.sla}% · refunds {s.refundRate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num text-lg leading-none font-semibold text-crit">{s.pulse}</p>
                      <p className="num mt-1 text-[11px] text-crit">
                        ↘ {Math.max(1, s.prevPulse - s.pulse)} this week
                      </p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="Store health heatmap"
          subtitle="Each cell is one dark store, coloured by PulseScore. Click any cell to drill in."
          right={<HeatmapLegend />}
        />
        <div className="p-4">
          <StoreHeatmap />
        </div>
      </Panel>
    </>
  );
}
