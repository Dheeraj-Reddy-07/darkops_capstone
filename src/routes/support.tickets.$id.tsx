import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, User, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, StatusBadge, Chip } from "@/components/ops/primitives";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/support/tickets/$id")({
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [newStatus, setNewStatus] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: async () => {
      return await fetchApi(`/support/tickets/${id}`);
    },
  });

  const { data: history } = useQuery({
    queryKey: ["ticket-history", id],
    queryFn: async () => {
      return await fetchApi(`/support/tickets/${id}/history`);
    },
  });

  if (isLoading) return <div className="p-8">Loading ticket details...</div>;
  if (!ticket) return <div className="p-8 text-crit">Ticket not found.</div>;

  const isSlaBreached = ticket.sla_deadline && new Date(ticket.sla_deadline) < new Date();

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    try {
      await fetchApi(`/support/tickets/${id}`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus, notes }),
      });
      navigate({ to: "/support" });
    } catch (error) {
      console.error("Failed to update ticket:", error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Ticket ${ticket.ticket_number}`}
        subtitle="Support ticket details and history"
        left={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/support" })}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        }
      />

      {/* Ticket Details */}
      <Panel>
        <PanelHeader title="Ticket Information" />
        <div className="grid grid-cols-2 gap-4 p-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Status</div>
            <StatusBadge status={ticket.status} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Priority</div>
            <StatusBadge status={ticket.priority} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Queue</div>
            <Chip>{ticket.queue}</Chip>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Assigned To</div>
            <div className="text-sm font-medium">
              {ticket.assigned_to_profile?.full_name || "Unassigned"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">SLA Deadline</div>
            <div className={cn(
              "text-sm",
              isSlaBreached ? "text-crit font-medium" : ""
            )}>
              {ticket.sla_deadline ? new Date(ticket.sla_deadline).toLocaleString() : "N/A"}
              {isSlaBreached && <AlertTriangle className="inline h-4 w-4 ml-1" />}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Created</div>
            <div className="text-sm">
              {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
        </div>
      </Panel>

      {/* Complaint Details */}
      {ticket.complaints && (
        <Panel>
          <PanelHeader title="Related Complaint" />
          <div className="p-4 space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Complaint Reference</div>
              <div className="text-sm font-medium">{ticket.complaints.complaint_ref}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Summary</div>
              <div className="text-sm">{ticket.complaints.summary}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Category</div>
              <Chip>{ticket.complaints.category}</Chip>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Detail</div>
              <div className="text-sm">{ticket.complaints.detail}</div>
            </div>
          </div>
        </Panel>
      )}

      {/* Update Status */}
      <Panel>
        <PanelHeader title="Update Ticket" />
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">New Status</label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add resolution notes or comments..."
              rows={3}
            />
          </div>
          <Button onClick={handleUpdateStatus} disabled={!newStatus}>
            Update Ticket
          </Button>
        </div>
      </Panel>

      {/* Ticket History */}
      <Panel>
        <PanelHeader title="Ticket History" />
        <div className="p-4">
          {history && history.length > 0 ? (
            <div className="space-y-3">
              {history.map((h: any) => (
                <div key={h.id} className="border-b border-border/70 pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{h.actor_profile?.full_name || "System"}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.occurred_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{h.action}</span>
                    {h.old_status && h.new_status && (
                      <span className="text-muted-foreground">
                        {" "}from {h.old_status} to {h.new_status}
                      </span>
                    )}
                  </div>
                  {h.notes && (
                    <div className="text-xs text-muted-foreground mt-1">{h.notes}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No history available</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
