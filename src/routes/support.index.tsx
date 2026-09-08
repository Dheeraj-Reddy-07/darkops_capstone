import { useMemo, useState, useCallback } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  Search,
  AlertTriangle,
  Clock,
  CheckCircle,
  Inbox,
  ChevronRight,
  User,
  Filter,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Chip,
  EmptyState,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  PriorityBadge,
  LoadingState,
  ErrorState,
  Td,
  Th,
  TableShell,
} from "@/components/ops/primitives";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchApi } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ─── Route Definition ────────────────────────────────────────────────────────

const searchSchema = z.object({
  tab: z.enum(["mine", "team", "unassigned", "resolved"]).optional().default("mine"),
  status: z.string().optional().default("all"),
  priority: z.string().optional().default("all"),
  queue: z.string().optional().default("all"),
  sla: z.string().optional().default("all"),
  q: z.string().optional().default(""),
});

export const Route = createFileRoute("/support/")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Support Workspace — DarkOps" },
      {
        name: "description",
        content: "Resolve assigned cases, manage SLA risk, and keep customer issues moving.",
      },
    ],
  }),
  component: SupportWorkspace,
});

// ─── SLA Helpers ─────────────────────────────────────────────────────────────

function getSlaState(deadline: string | null): "on_track" | "at_risk" | "breached" {
  if (!deadline) return "on_track";
  const remainMs = new Date(deadline).getTime() - Date.now();
  if (remainMs < 0) return "breached";
  if (remainMs < 30 * 60 * 1000) return "at_risk";
  return "on_track";
}

function formatSla(deadline: string | null): string {
  if (!deadline) return "N/A";
  const remainMs = new Date(deadline).getTime() - Date.now();
  if (remainMs < 0) {
    const breachMs = Math.abs(remainMs);
    const h = Math.floor(breachMs / 3600000);
    const m = Math.floor((breachMs % 3600000) / 60000);
    if (h > 0) return `Breached ${h}h ${m}m ago`;
    return `Breached ${m}m ago`;
  }
  const h = Math.floor(remainMs / 3600000);
  const m = Math.floor((remainMs % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

function formatRelative(ts: string): string {
  const diffMs = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── SLA indicator ───────────────────────────────────────────────────────────

function SlaCell({ deadline }: { deadline: string | null }) {
  const state = getSlaState(deadline);
  const label = formatSla(deadline);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        state === "breached" ? "text-crit" : state === "at_risk" ? "text-warn" : "text-ok",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full flex-shrink-0",
          state === "breached"
            ? "bg-crit"
            : state === "at_risk"
              ? "bg-warn animate-pulse"
              : "bg-ok",
        )}
      />
      {label}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone =
    s === "resolved" || s === "closed"
      ? "ok"
      : s === "escalated"
        ? "crit"
        : s === "in_progress"
          ? "info"
          : s === "awaiting_customer"
            ? "warn"
            : "neutral";
  const label =
    s === "in_progress"
      ? "In Progress"
      : s === "awaiting_customer"
        ? "Awaiting"
        : s.charAt(0).toUpperCase() + s.slice(1);
  return <Chip tone={tone}>{label}</Chip>;
}

// ─── Assignment label ─────────────────────────────────────────────────────────

function AssigneeLabel({ profile, currentUserId }: { profile: any; currentUserId: string }) {
  if (!profile) return <span className="text-xs text-muted-foreground">Unassigned</span>;
  const isMe = profile.id === currentUserId;
  return (
    <span
      className={cn(
        "text-xs flex items-center gap-1",
        isMe ? "text-primary font-medium" : "text-muted-foreground",
      )}
    >
      <User className="size-3 flex-shrink-0" />
      {isMe ? "You" : profile.full_name}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function SupportWorkspace() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/support/" });
  const queryClient = useQueryClient();

  const { tab, status, priority, queue, q } = search;

  // Current agent identity
  const { data: me } = useQuery({
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
      return profile as any;
    },
    staleTime: 60000,
  });

  // Personal KPI stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["my-support-stats"],
    queryFn: () => fetchApi("/support/me/stats"),
    refetchInterval: 60000,
  });

  // Tab data queries
  const myTicketsQuery = useQuery({
    queryKey: ["my-tickets", status, priority, queue, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (priority && priority !== "all") params.set("priority", priority);
      if (queue && queue !== "all") params.set("queue", queue);
      if (q) params.set("q", q);
      return fetchApi(`/support/me/tickets?${params}`);
    },
    enabled: tab === "mine",
  });

  const teamTicketsQuery = useQuery({
    queryKey: ["team-tickets", status, priority, queue, q],
    queryFn: () => {
      const params = new URLSearchParams();
      if (status && status !== "all") params.set("status", status);
      if (priority && priority !== "all") params.set("priority", priority);
      if (queue && queue !== "all") params.set("queue", queue);
      if (q) params.set("q", q);
      return fetchApi(`/support/team/tickets?${params}`);
    },
    enabled: tab === "team",
  });

  const unassignedQuery = useQuery({
    queryKey: ["unassigned-tickets"],
    queryFn: () => fetchApi("/support/unassigned/tickets"),
    enabled: tab === "unassigned",
  });

  const resolvedQuery = useQuery({
    queryKey: ["my-resolved-tickets"],
    queryFn: () => fetchApi("/support/me/resolved"),
    enabled: tab === "resolved",
  });

  // Determine active data
  const activeQuery =
    tab === "mine"
      ? myTicketsQuery
      : tab === "team"
        ? teamTicketsQuery
        : tab === "unassigned"
          ? unassignedQuery
          : resolvedQuery;

  const tickets: any[] = activeQuery.data?.data || [];

  // Client-side SLA filter (applied after fetch)
  const filteredTickets = useMemo(() => {
    if (search.sla === "all" || !search.sla) return tickets;
    return tickets.filter((t: any) => {
      const state = getSlaState(t.sla_deadline);
      if (search.sla === "breached") return state === "breached";
      if (search.sla === "at_risk") return state === "at_risk";
      if (search.sla === "on_track") return state === "on_track";
      return true;
    });
  }, [tickets, search.sla]);

  const setSearch = useCallback(
    (updates: Partial<typeof search>) => {
      navigate({
        to: "/support",
        search: (prev: any) => ({ ...prev, ...updates }),
        replace: true,
      });
    },
    [navigate],
  );

  const agentFirstName = me?.full_name?.split(" ")[0] || "Agent";

  // KPI counts from stats (all real, from database)
  const myOpen = stats?.my_open ?? (statsLoading ? "—" : 0);
  const urgent = stats?.urgent ?? (statsLoading ? "—" : 0);
  const atRisk = stats?.sla_at_risk ?? (statsLoading ? "—" : 0);
  const overdue = stats?.overdue ?? (statsLoading ? "—" : 0);

  const TABS = [
    { key: "mine", label: "My Tickets" },
    { key: "team", label: "Team Queue" },
    { key: "unassigned", label: "Unassigned" },
    { key: "resolved", label: "Resolved" },
  ] as const;

  return (
    <>
      <PageHeader
        title="Support Workspace"
        subtitle={`Resolve assigned cases, manage SLA risk, and keep customer issues moving.`}
        right={<LiveTag seconds={60} />}
      />

      {/* Agent identity bar */}
      {me && (
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
            {me.full_name
              ?.split(" ")
              .map((n: string) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </span>
          <span>
            Welcome back, <span className="font-medium text-foreground">{agentFirstName}</span>.
            {typeof myOpen === "number" && myOpen > 0 && (
              <span className="ml-1">
                <span className="num text-foreground">{myOpen}</span> ticket
                {myOpen !== 1 ? "s" : ""} assigned to you.
              </span>
            )}
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-6">
        <button
          onClick={() => setSearch({ tab: "mine", status: "all" })}
          className="text-left transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-md"
          aria-label="View my open tickets"
        >
          <KpiCard
            label="My Open"
            value={myOpen}
            footnote="active tickets assigned to you"
            tone={typeof myOpen === "number" && myOpen > 0 ? "neutral" : "neutral"}
          />
        </button>
        <button
          onClick={() => setSearch({ tab: "mine", priority: "P1" })}
          className="text-left transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-crit/40 rounded-md"
          aria-label="View urgent P1 tickets"
        >
          <KpiCard
            label="Urgent"
            value={urgent}
            footnote="P1 priority — act immediately"
            tone="crit"
            alert={typeof urgent === "number" && urgent > 0}
          />
        </button>
        <button
          onClick={() => setSearch({ tab: "mine", sla: "at_risk" })}
          className="text-left transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-warn/40 rounded-md"
          aria-label="View SLA at-risk tickets"
        >
          <KpiCard
            label="SLA at Risk"
            value={atRisk}
            footnote="approaching SLA deadline"
            tone={typeof atRisk === "number" && atRisk > 0 ? "warn" : "neutral"}
            alert={typeof atRisk === "number" && atRisk > 0}
          />
        </button>
        <button
          onClick={() => setSearch({ tab: "mine", sla: "breached" })}
          className="text-left transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-crit/40 rounded-md"
          aria-label="View overdue breached tickets"
        >
          <KpiCard
            label="Overdue"
            value={overdue}
            footnote="SLA already breached"
            tone="crit"
            alert={typeof overdue === "number" && overdue > 0}
          />
        </button>
      </div>

      {/* Main Panel */}
      <Panel>
        {/* Tab bar */}
        <div className="flex items-center border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSearch({ tab: t.key })}
              className={cn(
                "px-4 py-3 text-[13px] font-medium border-b-2 transition-colors",
                tab === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto px-4 py-2">
            <button
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: [
                    tab === "mine"
                      ? "my-tickets"
                      : tab === "team"
                        ? "team-tickets"
                        : "unassigned-tickets",
                  ],
                })
              }
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="size-3" />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab header */}
        <PanelHeader
          title={
            tab === "mine"
              ? "My Tickets"
              : tab === "team"
                ? "Team Queue"
                : tab === "unassigned"
                  ? "Unassigned Tickets"
                  : "Resolved"
          }
          subtitle={
            tab === "mine"
              ? "Cases currently assigned to you."
              : tab === "team"
                ? "All tickets across the support team. Clearly shows who owns what."
                : tab === "unassigned"
                  ? "Tickets not yet assigned to any agent. Claim them to start work."
                  : "Your resolved and closed cases."
          }
          right={
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  id="ticket-search"
                  type="text"
                  placeholder="Search ticket, issue, order…"
                  value={q}
                  onChange={(e) => setSearch({ q: e.target.value })}
                  className="pl-8 pr-3 py-1.5 rounded-md border border-border bg-surface-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                />
              </div>

              {/* Status filter */}
              <select
                id="status-filter"
                value={status}
                onChange={(e) => setSearch({ status: e.target.value })}
                className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_customer">Awaiting</option>
                <option value="escalated">Escalated</option>
              </select>

              {/* Priority filter */}
              <select
                id="priority-filter"
                value={priority}
                onChange={(e) => setSearch({ priority: e.target.value })}
                className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Priority</option>
                <option value="P1">P1 Critical</option>
                <option value="P2">P2 High</option>
                <option value="P3">P3 Medium</option>
                <option value="P4">P4 Low</option>
              </select>

              {/* Queue filter */}
              <select
                id="queue-filter"
                value={queue}
                onChange={(e) => setSearch({ queue: e.target.value })}
                className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Queues</option>
                <option value="refunds">Refunds</option>
                <option value="general">General</option>
                <option value="reorders">Reorders</option>
                <option value="operational">Operational</option>
                <option value="escalated">Escalated</option>
              </select>

              {/* SLA filter */}
              <select
                id="sla-filter"
                value={search.sla || "all"}
                onChange={(e) => setSearch({ sla: e.target.value })}
                className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All SLA</option>
                <option value="breached">Breached</option>
                <option value="at_risk">At Risk</option>
                <option value="on_track">On Track</option>
              </select>

              {/* Clear filters */}
              {(status !== "all" ||
                priority !== "all" ||
                queue !== "all" ||
                search.sla !== "all" ||
                q) && (
                <button
                  onClick={() =>
                    setSearch({ status: "all", priority: "all", queue: "all", sla: "all", q: "" })
                  }
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Filter className="size-3" />
                  Clear
                </button>
              )}
            </div>
          }
        />

        {/* Ticket table */}
        <TicketTable
          tickets={filteredTickets}
          isLoading={activeQuery.isLoading}
          isError={activeQuery.isError}
          onRetry={() => activeQuery.refetch()}
          tab={tab}
          currentUserId={me?.id}
          navigate={navigate}
          onClaimSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
            queryClient.invalidateQueries({ queryKey: ["unassigned-tickets"] });
            queryClient.invalidateQueries({ queryKey: ["my-support-stats"] });
          }}
        />
      </Panel>

      {/* Failed Automation Queue (secondary section) */}
      <FailedAutomationPanel navigate={navigate} />
    </>
  );
}

// ─── Ticket Table ─────────────────────────────────────────────────────────────

function TicketTable({
  tickets,
  isLoading,
  isError,
  onRetry,
  tab,
  currentUserId,
  navigate,
  onClaimSuccess,
}: {
  tickets: any[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  tab: string;
  currentUserId: string | undefined;
  navigate: any;
  onClaimSuccess: () => void;
}) {
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClaimingId(ticketId);
    try {
      await fetchApi(`/support/tickets/${ticketId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assign_to_self: true }),
      });
      onClaimSuccess();
    } catch (err: any) {
      console.error("Claim failed:", err.message);
    } finally {
      setClaimingId(null);
    }
  };

  if (isLoading) {
    return <LoadingState label="Loading tickets…" />;
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load tickets"
        hint="Check your connection or try again."
        onRetry={onRetry}
      />
    );
  }

  if (tickets.length === 0) {
    return (
      <EmptyState
        title={
          tab === "mine"
            ? "No tickets assigned to you"
            : tab === "unassigned"
              ? "No unassigned tickets"
              : "No tickets found"
        }
        hint={
          tab === "mine"
            ? "Your queue is clear — great work."
            : tab === "unassigned"
              ? "All tickets have been claimed."
              : "Try adjusting your filters."
        }
      />
    );
  }

  return (
    <TableShell>
      <thead>
        <tr>
          <Th>Ticket</Th>
          <Th>Issue</Th>
          {tab !== "mine" && <Th>Assigned To</Th>}
          <Th>Queue</Th>
          <Th>Priority</Th>
          <Th>SLA</Th>
          <Th>Status</Th>
          <Th>Updated</Th>
          <Th></Th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket: any) => {
          const slaState = getSlaState(ticket.sla_deadline);
          const isResolved = ticket.status === "resolved" || ticket.status === "closed";

          return (
            <tr
              key={ticket.id}
              onClick={() => navigate({ to: `/support/tickets/${ticket.id}` })}
              className={cn(
                "cursor-pointer transition-colors",
                "hover:bg-surface-2/70",
                slaState === "breached" && !isResolved && "bg-crit-soft/5 hover:bg-crit-soft/10",
              )}
            >
              <Td>
                <div className="flex items-center gap-2">
                  <span className="num text-xs font-semibold text-foreground">
                    {ticket.ticket_number}
                  </span>
                </div>
              </Td>
              <Td>
                <div className="min-w-0 max-w-[280px]">
                  <div className="text-sm font-medium text-foreground leading-snug truncate">
                    {ticket.title || ticket.complaints?.summary || "Untitled"}
                  </div>
                  {ticket.complaints?.order_id && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {ticket.complaints.order_id}
                    </div>
                  )}
                </div>
              </Td>
              {tab !== "mine" && (
                <Td>
                  <AssigneeLabel
                    profile={ticket.assigned_to_profile}
                    currentUserId={currentUserId || ""}
                  />
                </Td>
              )}
              <Td>
                <Chip>{ticket.queue}</Chip>
              </Td>
              <Td>
                <PriorityBadge priority={ticket.priority as any} />
              </Td>
              <Td>
                {isResolved ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <SlaCell deadline={ticket.sla_deadline} />
                )}
              </Td>
              <Td>
                <StatusChip status={ticket.status} />
              </Td>
              <Td>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(ticket.updated_at)}
                </span>
              </Td>
              <Td>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {tab === "unassigned" && (
                    <button
                      onClick={(e) => handleClaim(ticket.id, e)}
                      disabled={claimingId === ticket.id}
                      className={cn(
                        "flex items-center gap-1 rounded-sm border border-primary/40 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors",
                        claimingId === ticket.id && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <UserPlus className="size-3" />
                      {claimingId === ticket.id ? "Claiming…" : "Claim"}
                    </button>
                  )}
                  <button
                    onClick={() => navigate({ to: `/support/tickets/${ticket.id}` })}
                    className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80"
                  >
                    View
                    <ChevronRight className="size-3" />
                  </button>
                </div>
              </Td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}

// ─── Failed Automation Panel ──────────────────────────────────────────────────

function FailedAutomationPanel({ navigate }: { navigate: any }) {
  const queryClient = useQueryClient();
  const [reviewItem, setReviewItem] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["failed-automation"],
    queryFn: () => fetchApi("/support/failed-automation"),
    refetchInterval: 120000,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, notes, action_taken }: any) => {
      return fetchApi(`/support/failed-automation/${id}/resolve`, {
        method: "PUT",
        body: JSON.stringify({ notes, action_taken }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["failed-automation"] });
      setReviewItem(null);
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async ({ complaint_id, priority, title }: any) => {
      return fetchApi("/support/tickets", {
        method: "POST",
        body: JSON.stringify({ complaint_id, priority, title, queue: "general" }),
      });
    },
  });

  const rows: any[] = data?.data || [];

  if (isLoading) return null;
  if (rows.length === 0) return null;

  return (
    <>
      <Panel className="mt-6">
        <PanelHeader
          title="Automation Failures — Intake Queue"
          subtitle={`${rows.length} complaint${rows.length !== 1 ? "s" : ""} that couldn't be auto-processed. Review and create a ticket or resolve manually.`}
        />
        <TableShell>
          <thead>
            <tr>
              <Th>Complaint</Th>
              <Th>Failure Reason</Th>
              <Th>Urgency</Th>
              <Th>Sentiment</Th>
              <Th>Created</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f: any) => (
              <tr key={f.id} className="hover:bg-surface-2/50 transition-colors">
                <Td>
                  <div className="font-medium text-sm">{f.complaints?.complaint_ref}</div>
                  <div className="text-xs text-muted-foreground truncate max-w-[240px]">
                    {f.complaints?.summary}
                  </div>
                </Td>
                <Td>
                  <div className="text-xs">{f.failure_reason}</div>
                  <div className="text-xs text-muted-foreground">{f.failure_step}</div>
                </Td>
                <Td>
                  <span
                    className={cn(
                      "num text-xs font-semibold",
                      f.urgency_score >= 80
                        ? "text-crit"
                        : f.urgency_score >= 60
                          ? "text-warn"
                          : "text-ok",
                    )}
                  >
                    {f.urgency_score}/100
                  </span>
                </Td>
                <Td>
                  <Chip
                    tone={
                      f.sentiment === "negative"
                        ? "crit"
                        : f.sentiment === "positive"
                          ? "ok"
                          : "neutral"
                    }
                  >
                    {f.sentiment}
                  </Chip>
                </Td>
                <Td className="text-xs text-muted-foreground">{formatRelative(f.created_at)}</Td>
                <Td>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setReviewItem(f)}
                  >
                    Review
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>
      <ReviewAutomationDialog
        item={reviewItem}
        open={!!reviewItem}
        onOpenChange={(open) => !open && setReviewItem(null)}
        resolveMutation={resolveMutation}
        createTicketMutation={createTicketMutation}
        queryClient={queryClient}
      />
    </>
  );
}

// ─── Review Automation Dialog ──────────────────────────────────────────────────

function ReviewAutomationDialog({
  item,
  open,
  onOpenChange,
  resolveMutation,
  createTicketMutation,
  queryClient,
}: {
  item: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  resolveMutation: any;
  createTicketMutation: any;
  queryClient: any;
}) {
  const [mode, setMode] = useState<"view" | "resolve">("view");
  const [note, setNote] = useState("");

  const handleResolve = () => {
    if (!item) return;
    resolveMutation.mutate({ id: item.id, notes: note });
  };

  const handleCreateTicket = async () => {
    if (!item) return;
    try {
      const pScore = item.urgency_score || 0;
      const priority = pScore >= 80 ? "P1" : pScore >= 60 ? "P2" : "P3";

      const ticketRes = await createTicketMutation.mutateAsync({
        complaint_id: item.complaint_id,
        priority,
        title: item.complaints?.summary || "Failed Automation",
      });

      await resolveMutation.mutateAsync({
        id: item.id,
        action_taken: `Converted to Ticket ${ticketRes.ticket_number}`,
      });

      queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["team-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-tickets"] });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setMode("view");
      setNote("");
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle>Review Automation Failure</DialogTitle>
              <DialogDescription>
                {item.complaints?.complaint_ref} —{" "}
                {item.complaints?.summary || "No summary available"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Failure Reason
                  </div>
                  <div className="text-sm font-medium">{item.failure_reason}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">Failure Step</div>
                  <div className="text-sm">{item.failure_step}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Urgency Score
                  </div>
                  <div className="text-sm font-semibold">{item.urgency_score}/100</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">Sentiment</div>
                  <div className="text-sm">{item.sentiment}</div>
                </div>
              </div>

              {item.complaints?.detail && (
                <div>
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    Complaint Detail
                  </div>
                  <div className="text-sm bg-surface-2 p-3 rounded-md">
                    {item.complaints.detail}
                  </div>
                </div>
              )}

              {mode === "resolve" && (
                <div className="space-y-2 mt-4 pt-4 border-t border-border">
                  <label className="text-sm font-medium">Resolution Notes</label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="How was this resolved manually?"
                    className="text-sm"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              {mode === "view" ? (
                <>
                  <Button variant="outline" onClick={() => setMode("resolve")}>
                    Resolve Manually
                  </Button>
                  <Button
                    onClick={handleCreateTicket}
                    disabled={createTicketMutation.isPending || resolveMutation.isPending}
                  >
                    {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setMode("view")}>
                    Back
                  </Button>
                  <Button
                    onClick={handleResolve}
                    disabled={!note.trim() || resolveMutation.isPending}
                  >
                    {resolveMutation.isPending ? "Resolving..." : "Submit Resolution"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">Closing...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
