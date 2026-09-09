import { useMemo, useState } from "react";
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
import { Search, Phone, PhoneCall, PhoneOff } from "lucide-react";
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

function LiveCallPanel() {
  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [timer, setTimer] = useState<number>(0);
  const [timerId, setTimerId] = useState<any>(null);

  const startCall = () => {
    setCallState("dialing");
    setTimeout(() => {
      setCallState("connected");
      setTimer(0);
      const interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
      setTimerId(interval);
    }, 1500);
  };

  const endCall = () => {
    if (timerId) clearInterval(timerId);
    setCallState("ended");
  };

  const resetCall = () => {
    setCallState("idle");
    setTimer(0);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Panel>
      <PanelHeader title="Agent Live VoIP Call" subtitle="Escalation stream & interactive voice agent" />
      <div className="p-4 space-y-3">
        {callState === "idle" && (
          <div className="text-center py-3 space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-primary/10 text-primary">
              <Phone className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Simulate Customer Call</p>
              <p className="text-[11px] text-muted-foreground">Direct L2 escalation VoIP bridge</p>
            </div>
            <Button onClick={startCall} size="sm" className="w-full gap-2 text-xs">
              <PhoneCall className="size-3.5" /> Call Customer
            </Button>
          </div>
        )}

        {callState === "dialing" && (
          <div className="text-center py-3 space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-amber-500/10 text-amber-500 animate-pulse">
              <PhoneCall className="size-5 animate-bounce" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Connecting to customer...</p>
              <p className="text-[11px] text-muted-foreground">Establishing secure RTP stream</p>
            </div>
            <Button variant="outline" size="sm" onClick={endCall} className="w-full text-xs text-crit">
              Cancel Call
            </Button>
          </div>
        )}

        {callState === "connected" && (
          <div className="space-y-3 py-1">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <span className="relative flex size-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Live Call</span>
              </div>
              <span className="num text-xs font-bold text-foreground">{formatTimer(timer)}</span>
            </div>

            <div className="p-2.5 bg-muted/40 rounded text-[11px] space-y-1">
              <p className="text-muted-foreground font-medium">Real-time NLP sentiment transcript:</p>
              <p className="text-foreground italic">"Customer confirmed missing items. Escalation resolution approved."</p>
            </div>

            <Button variant="destructive" size="sm" onClick={endCall} className="w-full gap-2 text-xs">
              <PhoneOff className="size-3.5" /> End Call
            </Button>
          </div>
        )}

        {callState === "ended" && (
          <div className="text-center py-3 space-y-2">
            <div className="inline-flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground">
              <PhoneOff className="size-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Call Completed ({formatTimer(timer)})</p>
              <p className="text-[11px] text-muted-foreground">Audio recording & transcript saved</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetCall} className="w-full text-xs">
              Reset Call Simulator
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function OperationsQueue() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const { data, isLoading, error } = useCases();

  // Get current user ID for "My queue" filtering
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-auth"],
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    },
  });

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
      .sort((a, b) => b.ageMins - a.ageMins);
  }, [tab, query, currentUser?.id, data?.cases]);

  if (isLoading) return <div className="p-8">Loading live queue...</div>;
  if (error || !data) return <div className="p-8 text-crit">Failed to load operations queue.</div>;

  const { kpis, priorityMix, statusMix } = data;

  return (
    <>
      <PageHeader
        title="Operations queue"
        subtitle={`Shift 2 (14:00–22:00 IST) · ${kpis.agentsOnShift} agents on roster`}
        right={<LiveTag seconds={11} />}
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
          label="Agents available"
          value={num(kpis.agentsAvailable)}
          unit={`of ${kpis.agentsOnShift} on shift`}
          footnote="idle or under 60% load"
        />
        <KpiCard
          label="Awaiting assignment"
          value={num(kpis.awaitingAssignment)}
          tone="warn"
          footnote={`oldest waiting ${kpis.oldestWaitingMins}m`}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <LiveCallPanel />
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
                        <span className="num text-muted-foreground">{c.agentId}</span>
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
