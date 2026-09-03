import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, AlertTriangle, Clock, Users, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Chip,
  EmptyState,
  KpiCard,
  LiveTag,
  Panel,
  PanelHeader,
  StatusBadge,
  TableShell,
  Td,
  Th,
} from "@/components/ops/primitives";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { fetchApi } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/support/")({
  head: () => ({
    meta: [
      { title: "Customer Support - DarkOps" },
      {
        name: "description",
        content:
          "Customer support ticket management with automation queue, SLA tracking, and agent assignment.",
      },
      { property: "og:title", content: "Customer Support - DarkOps" },
      {
        property: "og:description",
        content: "Support dashboard for handling failed automation and manual review queues.",
      },
    ],
  }),
  component: SupportDashboard,
});

function SupportDashboard() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  // Fetch failed automation queue
  const { data: failedQueue, isLoading: failedLoading } = useQuery({
    queryKey: ["failed-automation"],
    queryFn: async () => {
      return await fetchApi("/support/failed-automation");
    },
  });

  // Fetch support tickets
  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["support-tickets", queue, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queue !== "all") params.append("queue", queue);
      if (status !== "all") params.append("status", status);
      return await fetchApi(`/support/tickets?${params}`);
    },
  });

  const failedRows = useMemo(() => {
    if (!failedQueue?.data) return [];
    return failedQueue.data.filter((f: any) => {
      if (query) {
        const q = query.toLowerCase();
        return (
          f.complaints?.complaint_ref?.toLowerCase().includes(q) ||
          f.complaints?.summary?.toLowerCase().includes(q) ||
          f.complaints?.store_id?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [failedQueue, query]);

  const ticketRows = useMemo(() => {
    if (!tickets?.data) return [];
    return tickets.data.filter((t: any) => {
      if (query) {
        const q = query.toLowerCase();
        return (
          t.ticket_number?.toLowerCase().includes(q) ||
          t.complaints?.complaint_ref?.toLowerCase().includes(q) ||
          t.complaints?.summary?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, query]);

  if (failedLoading || ticketsLoading) return <div className="p-8">Loading support dashboard...</div>;

  const failedCount = failedQueue?.data?.length || 0;
  const ticketsCount = tickets?.data?.length || 0;
  const highUrgencyCount = failedRows.filter((f: any) => f.urgency_score >= 80).length;
  const slaBreachedCount = ticketRows.filter((t: any) => {
    if (!t.sla_deadline) return false;
    return new Date(t.sla_deadline) < new Date();
  }).length;

  return (
    <>
      <PageHeader
        title="Customer Support"
        subtitle="Failed automation queue and ticket management with SLA tracking."
        right={<LiveTag seconds={11} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Failed automation"
          value={failedCount}
          footnote="awaiting manual review"
          tone="crit"
          alert={failedCount > 0}
        />
        <KpiCard
          label="High urgency"
          value={highUrgencyCount}
          footnote="urgency score ≥ 80"
          tone="crit"
          alert={highUrgencyCount > 0}
        />
        <KpiCard
          label="Active tickets"
          value={ticketsCount}
          footnote="in all queues"
        />
        <KpiCard
          label="SLA breached"
          value={slaBreachedCount}
          footnote="past deadline"
          tone="crit"
          alert={slaBreachedCount > 0}
        />
      </div>

      {/* Failed Automation Queue */}
      <Panel className="mt-6">
        <PanelHeader
          title="Failed Automation Queue"
          subtitle="Complaints that couldn't be auto-processed, sorted by urgency"
          right={
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border rounded-md text-sm w-64"
                />
              </div>
            </div>
          }
        />
        <TableShell>
          <thead>
            <tr>
              <Th>Complaint</Th>
              <Th>Category</Th>
              <Th>Failure Reason</Th>
              <Th>Urgency</Th>
              <Th>Sentiment</Th>
              <Th>Created</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {failedRows.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center py-8">
                  <EmptyState title="No failed automations" hint="All complaints processed successfully" />
                </Td>
              </tr>
            ) : (
              failedRows.map((f: any) => (
                <tr key={f.id}>
                  <Td>
                    <div className="font-medium">{f.complaints?.complaint_ref}</div>
                    <div className="text-sm text-muted-foreground">{f.complaints?.summary}</div>
                  </Td>
                  <Td>
                    <Chip>{f.complaints?.category}</Chip>
                  </Td>
                  <Td>
                    <div className="text-sm">{f.failure_reason}</div>
                    <div className="text-xs text-muted-foreground">{f.failure_step}</div>
                  </Td>
                  <Td>
                    <div className={cn(
                      "font-medium",
                      f.urgency_score >= 80 ? "text-crit" : f.urgency_score >= 60 ? "text-warn" : "text-ok"
                    )}>
                      {f.urgency_score}/100
                    </div>
                  </Td>
                  <Td>
                    <Chip tone={f.sentiment === 'negative' ? 'crit' : f.sentiment === 'positive' ? 'ok' : 'neutral'}>
                      {f.sentiment}
                    </Chip>
                  </Td>
                  <Td className="text-sm">
                    {new Date(f.created_at).toLocaleString()}
                  </Td>
                  <Td>
                    <button
                      onClick={() => {
                        // Navigate to ticket detail if a ticket exists for this complaint
                        const relatedTicket = tickets?.data?.find((t: any) => t.complaint_id === f.complaint_id);
                        if (relatedTicket) {
                          navigate({ to: `/support/tickets/${relatedTicket.id}` });
                        }
                      }}
                      disabled={!tickets?.data?.find((t: any) => t.complaint_id === f.complaint_id)}
                      className="text-primary hover:underline text-sm disabled:text-muted-foreground disabled:no-underline"
                    >
                      Review
                    </button>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </TableShell>
      </Panel>

      {/* Support Tickets */}
      <Panel className="mt-6">
        <PanelHeader
          title="Support Tickets"
          subtitle="JIRA-level ticket management with queues and SLA tracking"
          right={
            <div className="flex gap-2">
              <Select value={queue} onValueChange={setQueue}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Queue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Queues</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="refunds">Refunds</SelectItem>
                  <SelectItem value="reorders">Reorders</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
        <TableShell>
          <thead>
            <tr>
              <Th>Ticket</Th>
              <Th>Complaint</Th>
              <Th>Queue</Th>
              <Th>Priority</Th>
              <Th>Assigned To</Th>
              <Th>SLA Deadline</Th>
              <Th>Status</Th>
              <Th>Action</Th>
            </tr>
          </thead>
          <tbody>
            {ticketRows.length === 0 ? (
              <tr>
                <Td colSpan={8} className="text-center py-8">
                  <EmptyState title="No tickets found" hint="Try adjusting filters" />
                </Td>
              </tr>
            ) : (
              ticketRows.map((t: any) => {
                const isSlaBreached = t.sla_deadline && new Date(t.sla_deadline) < new Date();
                return (
                  <tr key={t.id}>
                    <Td>
                      <div className="font-medium">{t.ticket_number}</div>
                    </Td>
                    <Td>
                      <div className="text-sm">{t.complaints?.complaint_ref}</div>
                      <div className="text-xs text-muted-foreground">{t.complaints?.summary}</div>
                    </Td>
                    <Td>
                      <Chip>{t.queue}</Chip>
                    </Td>
                    <Td>
                      <StatusBadge status={t.priority} />
                    </Td>
                    <Td>
                      <div className="text-sm">{t.assigned_to_profile?.full_name || 'Unassigned'}</div>
                    </Td>
                    <Td>
                      <div className={cn(
                        "text-sm",
                        isSlaBreached ? "text-crit font-medium" : ""
                      )}>
                        {t.sla_deadline ? new Date(t.sla_deadline).toLocaleString() : 'N/A'}
                        {isSlaBreached && <AlertTriangle className="inline h-4 w-4 ml-1" />}
                      </div>
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td>
                      <button
                        onClick={() => navigate({ to: `/support/tickets/${t.id}` })}
                        className="text-primary hover:underline text-sm"
                      >
                        View
                      </button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableShell>
      </Panel>
    </>
  );
}
