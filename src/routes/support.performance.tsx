import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Inbox, ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Panel,
  PanelHeader,
  KpiCard,
  Chip,
  TableShell,
  Th,
  Td,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/ops/primitives";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { initialIdentity, fetchCurrentUser, isSupportLead } from "@/lib/current-user";
import { cn, num, minutesToDuration } from "@/lib/utils";

const PERIODS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
] as const;

type Period = (typeof PERIODS)[number]["key"];

const searchSchema = (search: Record<string, unknown>): { period: Period } => {
  const p = search.period;
  return { period: p === "24h" || p === "30d" ? p : "7d" };
};

export const Route = createFileRoute("/support/performance")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Team Performance - DarkOps Support" },
      {
        name: "description",
        content: "Support Lead view of per-agent workload and resolution performance.",
      },
    ],
  }),
  component: TeamPerformance,
});

interface AgentPerf {
  agent_id: string;
  full_name: string;
  email: string;
  role: string;
  open_tickets: number;
  urgent_open: number;
  sla_breached_open: number;
  resolved_period: number;
  resolved_today: number;
  avg_resolution_minutes: number | null;
}

interface PerfResponse {
  period: string;
  data: AgentPerf[];
  summary: {
    total_open: number;
    total_resolved_period: number;
    total_resolved_today: number;
    total_urgent_open: number;
    total_sla_breached_open: number;
    agent_count: number;
  };
}

function TeamPerformance() {
  const { period } = Route.useSearch();
  const navigate = Route.useNavigate();

  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    initialData: initialIdentity,
    staleTime: 60000,
  });

  const isLead = isSupportLead(me);

  const { data, isLoading, isError, refetch } = useQuery<PerfResponse>({
    queryKey: ["team-performance", period],
    queryFn: () => fetchApi(`/support/team/performance?period=${period}`),
    enabled: !!isLead,
    refetchInterval: 60000,
  });

  const setPeriod = (p: Period) =>
    navigate({ search: (prev) => ({ ...prev, period: p }), replace: true });

  const periodLabel =
    period === "24h" ? "last 24h" : period === "30d" ? "last 30 days" : "last 7 days";

  if (me && !isLead) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Team Performance"
          subtitle="Per-agent workload and resolution performance."
        />
        <Panel className="mx-auto max-w-2xl p-8 text-center">
          <AlertTriangle className="mx-auto mb-3 size-10 text-warn" />
          <h2 className="text-lg font-bold text-foreground">Restricted to the Support Lead</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You are signed in as{" "}
            <strong className="text-foreground">{me.full_name || me.email}</strong>. Team
            performance is available to the Support Lead only.
          </p>
        </Panel>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <>
      <PageHeader
        title="Team Performance"
        subtitle="Per-agent workload and resolution throughput across the support team."
        right={
          <div className="flex gap-1.5">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        }
      />

      {/* Team summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="Active tickets"
          loading={isLoading}
          value={num(summary?.total_open ?? 0)}
          footnote="open across team"
        />
        <KpiCard
          label={`Resolved (${period})`}
          loading={isLoading}
          value={num(summary?.total_resolved_period ?? 0)}
          tone="ok"
          footnote={`resolved ${periodLabel}`}
        />
        <KpiCard
          label="Resolved today"
          loading={isLoading}
          value={num(summary?.total_resolved_today ?? 0)}
          tone="ok"
          footnote="since midnight"
        />
        <KpiCard
          label="Urgent open"
          loading={isLoading}
          value={num(summary?.total_urgent_open ?? 0)}
          tone="crit"
          alert={(summary?.total_urgent_open ?? 0) > 0}
          footnote="P1 in progress"
        />
        <KpiCard
          label="SLA breached"
          loading={isLoading}
          value={num(summary?.total_sla_breached_open ?? 0)}
          tone="warn"
          alert={(summary?.total_sla_breached_open ?? 0) > 0}
          footnote="open past SLA"
        />
      </div>

      <Panel>
        <PanelHeader
          title="Agent performance"
          subtitle={`Workload and resolution metrics for the ${periodLabel}. Live, from the ticket record.`}
        />

        {isLoading ? (
          <LoadingState label="Loading performance…" />
        ) : isError ? (
          <ErrorState
            title="Failed to load performance"
            hint="The performance feed did not respond."
            onRetry={() => refetch()}
          />
        ) : !data?.data.length ? (
          <EmptyState title="No agents found" hint="No active support agents to report on." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Agent</Th>
                <Th>Role</Th>
                <Th align="center">Open</Th>
                <Th align="center">Urgent P1</Th>
                <Th align="center">SLA breached</Th>
                <Th align="center">Resolved ({period})</Th>
                <Th align="center">Resolved today</Th>
                <Th align="right">Avg resolution</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((a) => (
                <tr key={a.agent_id} className="row-hover">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(a.full_name || a.email || "?").charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{a.full_name}</div>
                        <div className="num truncate text-xs text-muted-foreground">{a.email}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <Chip tone={a.role === "SUPPORT_LEAD" ? "info" : "neutral"}>
                      {a.role === "SUPPORT_LEAD" ? "Lead" : "Agent"}
                    </Chip>
                  </Td>
                  <Td align="center" className="num font-semibold">
                    {a.open_tickets}
                  </Td>
                  <Td
                    align="center"
                    className={cn(
                      "num font-semibold",
                      a.urgent_open > 0 ? "text-crit" : "text-muted-foreground",
                    )}
                  >
                    {a.urgent_open || "-"}
                  </Td>
                  <Td
                    align="center"
                    className={cn(
                      "num font-semibold",
                      a.sla_breached_open > 0 ? "text-warn" : "text-muted-foreground",
                    )}
                  >
                    {a.sla_breached_open || "-"}
                  </Td>
                  <Td align="center" className="num font-semibold text-ok">
                    {a.resolved_period || "-"}
                  </Td>
                  <Td align="center" className="num font-semibold">
                    {a.resolved_today || "-"}
                  </Td>
                  <Td align="right" className="num text-muted-foreground">
                    {a.avg_resolution_minutes != null
                      ? minutesToDuration(a.avg_resolution_minutes)
                      : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Inbox className="size-3.5" /> Open = active tickets (not resolved/closed)
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="size-3.5" /> SLA breached = open tickets past deadline
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" /> Resolved = attributed to the resolving agent
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" /> {summary?.agent_count ?? 0} active agents
        </span>
      </div>
    </>
  );
}
