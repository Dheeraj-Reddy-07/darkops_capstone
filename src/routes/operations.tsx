import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  EmptyState,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  PriorityBadge,
  StatusBadge,
  SlaIndicator,
  TableShell,
  Td,
  Th,
} from "@/components/ops/primitives";
import { useCases } from "@/hooks/useCases";
import { ageLabel, num } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/operations")({
  head: () => ({
    meta: [
      { title: "Operations queue - DarkOps" },
      {
        name: "description",
        content:
          "Live case queue, SLA breaches, agent workload and priority mix for dark store complaint resolution.",
      },
      { property: "og:title", content: "Operations queue - DarkOps" },
      {
        property: "og:description",
        content: "Live complaint case queue with SLA risk, priority mix and agent workload.",
      },
    ],
  }),
  component: OperationsQueue,
});

const TABS = ["All", "P1", "P2", "P3", "P4", "Escalated", "My queue"] as const;
const PIE_COLORS = ["var(--crit)", "var(--warn)", "var(--chart-1)", "var(--chart-5)"];

const axis = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
};
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  borderColor: "var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function ExceptionDriversCard({
  drivers,
}: {
  drivers: Array<{ key: string; label: string; count: number; percentage: number }>;
}) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const maxCount = Math.max(1, ...(drivers?.map((d) => d.count) || [1]));

  return (
    <Panel className="flex flex-col justify-between">
      <PanelHeader title="Exception Drivers" subtitle="Top issues driving operational workload" />
      <div className="p-4 space-y-2.5 flex-1">
        {!drivers || drivers.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No active exception drivers recorded
          </div>
        ) : (
          drivers.map((driver, idx) => {
            const barWidthPercent = Math.max(8, Math.round((driver.count / maxCount) * 100));
            return (
              <div key={driver.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {driver.label}
                  </span>
                  <span className="num font-semibold text-foreground">{driver.count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: animated ? `${barWidthPercent}%` : "0%",
                      transitionDelay: `${idx * 90}ms`,
                      backgroundColor:
                        idx === 0 ? "var(--crit)" : idx === 1 ? "var(--warn)" : "var(--chart-1)",
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-2 text-[11px]">
        <Link
          to="/dark-stores"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          View dark store trends <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </Panel>
  );
}

function OperationsQueue() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sla" | "age" | "priority" | "store">("sla");
  const navigate = useNavigate();

  // Current user profile drives the "My queue" filter and the auto-refresh preference.
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      return { ...profile, id: user.id } as any;
    },
  });

  const autoRefresh = !!currentUser?.preferences?.autoRefresh;
  const { data, isLoading, error } = useCases(autoRefresh);

  const rows = useMemo(() => {
    if (!data?.cases) return [];
    return data.cases
      .filter((c) => {
        if (tab === "Escalated" && !c.status.includes("escalated")) return false;
        if (tab === "My queue" && c.agentId !== currentUser?.id) return false;
        if (tab.startsWith("P") && tab.length === 2 && c.priority !== tab) return false;
        if (query) {
          const q = query.toLowerCase();
          return (
            c.id.toLowerCase().includes(q) ||
            c.complaintId.toLowerCase().includes(q) ||
            c.summary.toLowerCase().includes(q) ||
            c.storeName.toLowerCase().includes(q) ||
            c.storeId.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "age") return b.ageMins - a.ageMins;
        if (sortBy === "priority") return a.priority.localeCompare(b.priority);
        if (sortBy === "store") return a.storeName.localeCompare(b.storeName);
        const slaOrder = { breached: 0, "at-risk": 1, ok: 2 };
        const diff = slaOrder[a.sla] - slaOrder[b.sla];
        if (diff !== 0) return diff;
        return b.ageMins - a.ageMins;
      });
  }, [tab, query, currentUser?.id, data?.cases, sortBy]);

  if (isLoading) return <div className="p-8">Loading live queue...</div>;
  if (error || !data) return <div className="p-8 text-crit">Failed to load operations queue.</div>;

  const { kpis, priorityMix, statusMix, exceptionDrivers } = data;

  return (
    <>
      <PageHeader
        title="Operations queue"
        subtitle={`Live case queue · ${num(kpis.pending)} pending across all hubs`}
        right={<LiveTag seconds={15} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Pending cases" value={num(kpis.pending)} footnote="open across all hubs" />
        <KpiCard
          label="Escalated cases"
          value={num(kpis.escalated)}
          tone="warn"
          footnote="L2 / regional manager"
        />
        <KpiCard
          label="SLA breaches today"
          value={num(kpis.slaBreaches)}
          tone="crit"
          alert
          footnote="past 2h response SLA"
        />
        <KpiCard
          label="In progress"
          value={num(kpis.inProgress)}
          tone="info"
          footnote="actively being worked"
        />
        <KpiCard
          label="Awaiting assignment"
          value={num(kpis.awaitingAssignment)}
          tone="warn"
          footnote={`oldest waiting ${kpis.oldestWaitingMins}m`}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <ExceptionDriversCard drivers={exceptionDrivers} />
        <Panel>
          <PanelHeader
            title="Complaint priority mix"
            subtitle={`All ${num(kpis.pending)} pending cases, split by priority.`}
          />
          <div className="flex items-center gap-4 p-4">
            <ResponsiveContainer width="55%" height={168}>
              <PieChart>
                <Pie
                  data={priorityMix}
                  dataKey="value"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={1}
                  stroke="var(--surface)"
                >
                  {priorityMix.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--foreground)" }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 500, marginBottom: 4 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="flex-1 space-y-2">
              {priorityMix.map((p, i) => (
                <li key={p.key} className="flex items-center gap-2 text-xs">
                  <span
                    className="size-2.5 rounded-[2px]"
                    style={{ backgroundColor: PIE_COLORS[i] }}
                  />
                  <span className="flex-1">{p.name}</span>
                  <span className="num font-medium">{num(p.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Case status mix"
            subtitle="Distribution of unassigned, assigned, and in-progress."
          />
          <div className="p-4">
            <ResponsiveContainer width="100%" height={168}>
              <BarChart data={statusMix} margin={{ left: -20, right: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" {...axis} interval={0} />
                <YAxis {...axis} width={44} />
                <RTooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--popover-foreground)" }}
                  cursor={{ fill: "var(--surface-2)" }}
                />
                <Bar dataKey="value" name="Cases" fill="var(--chart-1)" maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="Live case queue"
          subtitle="Sorted by SLA risk. Unassigned cases first - assign or escalate."
          right={<Chip tone="warn">{kpis.awaitingAssignment} awaiting assignment</Chip>}
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-0.5">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs transition-colors",
                  tab === t
                    ? "bg-surface-3 font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex h-7 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by case, complaint or store"
                className="w-56 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="h-7 w-44 text-xs bg-surface-2 border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sla">Sort: SLA Risk First</SelectItem>
                <SelectItem value="age">Sort: Oldest Waiting</SelectItem>
                <SelectItem value="priority">Sort: Priority (P1 → P4)</SelectItem>
                <SelectItem value="store">Sort: Store Name (A → Z)</SelectItem>
              </SelectContent>
            </Select>
            <span className="num text-xs text-muted-foreground">{rows.length} shown</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No cases match this filter"
            hint="Clear the search or switch back to the All tab to see the full queue."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Case ID</Th>
                <Th>Complaint</Th>
                <Th>Store</Th>
                <Th>Priority</Th>
                <Th>Assigned agent</Th>
                <Th>Status</Th>
                <Th>SLA</Th>
                <Th align="right">Age</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 40).map((c) => {
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate({ to: "/cases/$id", params: { id: c.id } })}
                    className="row-hover cursor-pointer"
                  >
                    <Td className="num text-[13px]">{c.id}</Td>
                    <Td>
                      <p className="num text-[13px]">{c.complaintId}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.summary}</p>
                    </Td>
                    <Td>
                      <Link
                        to="/dark-stores/$id"
                        params={{ id: c.storeId }}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[13px] hover:text-primary"
                      >
                        {c.storeName}
                      </Link>
                      <p className="num mt-0.5 text-xs text-muted-foreground">{c.storeId}</p>
                    </Td>
                    <Td>
                      <PriorityBadge priority={c.priority as "P1" | "P2" | "P3" | "P4"} />
                    </Td>
                    <Td className="text-[13px]">
                      {c.agentId ? (
                        <span className="text-muted-foreground">
                          {c.agentName || "Assigned agent"}
                        </span>
                      ) : (
                        <span className="text-warn">Unassigned</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td>
                      <SlaIndicator
                        state={c.sla === "ok" ? "on-track" : (c.sla as "at-risk" | "breached")}
                      />
                    </Td>
                    <Td align="right">
                      <span
                        className={cn(
                          "num text-[13px]",
                          c.sla === "breached"
                            ? "text-crit"
                            : c.sla === "at-risk"
                              ? "text-warn"
                              : "text-ok",
                        )}
                      >
                        {ageLabel(c.ageMins)}
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
