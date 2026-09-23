import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  MessageSquare,
  Tag,
  Building2,
  Package,
  ShoppingCart,
  Upload,
  X,
  ChevronDown,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Panel,
  PanelHeader,
  PriorityBadge,
  Chip,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@/components/ops/primitives";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { initialIdentity, fetchCurrentUser, isSupportLead } from "@/lib/current-user";
import { toast } from "sonner";
import {
  formatCategory,
  formatStatus,
  formatQueue,
  formatResolution,
  formatPriority,
} from "@/lib/formatters";

export const Route = createFileRoute("/support/tickets/$id")({
  head: ({ params }) => ({
    meta: [{ title: `Ticket ${params.id} - DarkOps Support` }],
  }),
  component: TicketDetail,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    const m = Math.round(Math.abs(remainMs) / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `Breached ${h}h ${m % 60}m ago`;
    return `Breached ${m}m ago`;
  }
  const h = Math.floor(remainMs / 3600000);
  const m = Math.floor((remainMs % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function formatCurrency(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN")}`;
}

// ─── SLA Banner ───────────────────────────────────────────────────────────────

function SlaBanner({ deadline }: { deadline: string | null }) {
  const state = getSlaState(deadline);
  const label = formatSla(deadline);
  if (state === "on_track") return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium",
        state === "breached"
          ? "border-crit/40 bg-crit-soft/20 text-crit"
          : "border-warn/40 bg-warn-soft/20 text-warn",
      )}
    >
      <AlertTriangle className="size-4 flex-shrink-0" />
      SLA {state === "breached" ? "Breached" : "At Risk"} - {label}
    </div>
  );
}

// ─── Event type labels ────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  created: "Ticket created",
  assigned: "Assigned",
  status_changed: "Status changed",
  note_added: "Note added",
  resolved: "Resolved",
  attachment_added: "Attachment added",
  attachment_deleted: "Attachment deleted",
};

function EventIcon({ type }: { type: string }) {
  const base = "flex size-7 items-center justify-center rounded-full border";
  if (type === "created")
    return (
      <span className={cn(base, "border-border bg-surface-3")}>
        <Tag className="size-3.5 text-muted-foreground" />
      </span>
    );
  if (type === "assigned")
    return (
      <span className={cn(base, "border-primary/30 bg-primary/10")}>
        <User className="size-3.5 text-primary" />
      </span>
    );
  if (type === "status_changed")
    return (
      <span className={cn(base, "border-info/30 bg-info/10")}>
        <Clock className="size-3.5 text-info" />
      </span>
    );
  if (type === "resolved")
    return (
      <span className={cn(base, "border-ok/30 bg-ok/10")}>
        <CheckCircle2 className="size-3.5 text-ok" />
      </span>
    );
  if (type === "attachment_added")
    return (
      <span className={cn(base, "border-border bg-surface-3")}>
        <Paperclip className="size-3.5 text-muted-foreground" />
      </span>
    );
  if (type === "attachment_deleted")
    return (
      <span className={cn(base, "border-destructive/30 bg-destructive/10")}>
        <Trash2 className="size-3.5 text-destructive" />
      </span>
    );
  return (
    <span className={cn(base, "border-border bg-surface-3")}>
      <MessageSquare className="size-3.5 text-muted-foreground" />
    </span>
  );
}

function EventDescription({ event }: { event: any }) {
  const { event_type, payload, actor } = event;
  const actorName = actor?.full_name || "System";

  if (event_type === "created") {
    return (
      <span>
        <strong>{actorName}</strong> {payload?.title || "created this ticket"}
      </span>
    );
  }
  if (event_type === "assigned") {
    return (
      <span>
        <strong>{actorName}</strong> assigned to{" "}
        <strong>{payload?.to_name || payload?.to || "unknown"}</strong>
        {payload?.from && ` (from ${payload.from})`}
      </span>
    );
  }
  if (event_type === "status_changed") {
    return (
      <span>
        <strong>{actorName}</strong> changed status from{" "}
        <Chip className="inline">{payload?.from}</Chip> to{" "}
        <Chip className="inline">{payload?.to}</Chip>
        {payload?.note && (
          <span className="block mt-1 text-muted-foreground italic">"{payload.note}"</span>
        )}
      </span>
    );
  }
  if (event_type === "note_added") {
    return (
      <span>
        <strong>{actorName}</strong> added a note:
        <span className="block mt-1 text-foreground italic">"{payload?.note}"</span>
      </span>
    );
  }
  if (event_type === "resolved") {
    return (
      <span>
        <strong>{actorName}</strong> resolved this ticket
        {payload?.note && (
          <span className="block mt-1 text-muted-foreground italic">"{payload.note}"</span>
        )}
        {payload?.resolution_time_minutes && (
          <span className="block mt-0.5 text-xs text-muted-foreground">
            Resolution time: {Math.floor(payload.resolution_time_minutes / 60)}h{" "}
            {payload.resolution_time_minutes % 60}m
          </span>
        )}
      </span>
    );
  }
  if (event_type === "attachment_added") {
    return (
      <span>
        <strong>{actorName}</strong> attached <strong>{payload?.filename}</strong>
      </span>
    );
  }
  if (event_type === "attachment_deleted") {
    return (
      <span>
        <strong>{actorName}</strong> deleted <strong>{payload?.filename}</strong>
      </span>
    );
  }
  return (
    <span>
      <strong>{actorName}</strong> {EVENT_LABELS[event_type] || event_type}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Current agent identity — actual signed-in user (mock session or real profile).
  const { data: me } = useQuery({
    queryKey: ["current-user"],
    queryFn: fetchCurrentUser,
    initialData: initialIdentity,
    staleTime: 60000,
  });
  const isLead = isSupportLead(me);

  // Real support roster (Lead only) — used to populate the reassign dropdown with
  // genuine agent profile ids instead of hardcoded mock ids.
  const { data: workload } = useQuery({
    queryKey: ["team-workload"],
    queryFn: () => fetchApi("/support/team/workload"),
    enabled: isLead,
    staleTime: 60000,
  });
  const roster: any[] = workload?.data || [];

  // Ticket data
  const {
    data: ticket,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["support-ticket", id],
    queryFn: () => fetchApi(`/support/tickets/${id}`),
  });

  // Activity
  const { data: activityData } = useQuery({
    queryKey: ["ticket-activity", id],
    queryFn: () => fetchApi(`/support/tickets/${id}/activity`),
    enabled: !!ticket,
  });
  const activity: any[] = activityData?.data || [];

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["support-ticket", id] });
    queryClient.invalidateQueries({ queryKey: ["ticket-activity", id] });
    queryClient.invalidateQueries({ queryKey: ["my-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["my-support-stats"] });
    queryClient.invalidateQueries({ queryKey: ["team-tickets"] });
  };

  const assignMutation = useMutation({
    mutationFn: (targetId?: string | null) =>
      fetchApi(`/support/tickets/${id}/assign`, {
        method: "PATCH",
        body: JSON.stringify(
          targetId !== undefined ? { assigned_to: targetId } : { assign_to_self: true },
        ),
      }),
    onSuccess: () => {
      toast.success("Assignment updated");
      invalidateAll();
    },
    onError: (err: any) => toast.error(`Failed to assign: ${err.message}`),
  });

  const statusMutation = useMutation({
    mutationFn: (newStatus: string) =>
      fetchApi(`/support/tickets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      }),
    onSuccess: (_, newStatus) => {
      toast.success(`Status updated to ${newStatus}`);
      setStatusDropdownOpen(false);
      invalidateAll();
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const [resolutionDecision, setResolutionDecision] = useState<string>("REFUND");

  const resolveMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/support/tickets/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          resolution_note: resolutionNote,
          resolution_decision: resolutionDecision,
        }),
      }),
    onSuccess: () => {
      toast.success("Ticket resolved successfully");
      setShowResolveForm(false);
      setResolutionNote("");
      invalidateAll();
    },
    onError: (err: any) => toast.error(`Failed to resolve: ${err.message}`),
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      fetchApi(`/support/tickets/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ note: noteText }),
      }),
    onSuccess: () => {
      toast.success("Note added");
      setShowNoteForm(false);
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["ticket-activity", id] });
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      fetchApi(`/support/tickets/${id}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success("Attachment deleted");
      invalidateAll();
    },
    onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
  });

  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Get signed upload URL
      const params = new URLSearchParams({ filename: file.name, content_type: file.type });
      const { signed_url, storage_path } = await fetchApi(
        `/support/tickets/${id}/attachments/upload-url?${params}`,
      );

      // Upload directly to Supabase Storage
      const uploadRes = await fetch(signed_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      // Register attachment record
      await fetchApi(`/support/tickets/${id}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          storage_path,
          file_type: file.type,
          file_size_bytes: file.size,
        }),
      });

      toast.success(`${file.name} uploaded`);
      invalidateAll();
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (attachmentId: string, filename: string) => {
    try {
      const { signed_url } = await fetchApi(
        `/support/tickets/${id}/attachments/${attachmentId}/download`,
      );

      // Fetch the file as a blob to ensure it downloads instead of opening
      const response = await fetch(signed_url);
      if (!response.ok) throw new Error("Failed to fetch file");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingState label="Loading ticket…" />;
  if (isError || !ticket) {
    return (
      <ErrorState
        title="Unable to load ticket"
        hint="This ticket may not exist or you may not have access to it."
        onRetry={refetch}
      />
    );
  }

  const slaState = getSlaState(ticket.sla_deadline);
  const isResolved = ticket.status === "resolved" || ticket.status === "closed";
  const isAssignedToMe = ticket.assigned_to === me?.id;
  const isAssigned = !!ticket.assigned_to;

  const NEXT_STATUSES: Record<string, string[]> = {
    open: ["in_progress"],
    in_progress: ["awaiting_customer", "escalated"],
    awaiting_customer: ["in_progress"],
    escalated: ["in_progress"],
  };
  const nextStatuses = NEXT_STATUSES[ticket.status] || [];

  return (
    <div className="space-y-5">
      {/* Back navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/support" })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to workspace
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="num text-sm font-semibold text-foreground">{ticket.ticket_number}</span>
      </div>

      {/* SLA alert banner */}
      {!isResolved && <SlaBanner deadline={ticket.sla_deadline} />}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight text-foreground">
            {ticket.title || ticket.complaints?.summary || "Untitled Ticket"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="num text-xs text-muted-foreground">{ticket.ticket_number}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusChip status={ticket.status} />
            {!isResolved && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs",
                  slaState === "breached"
                    ? "text-crit"
                    : slaState === "at_risk"
                      ? "text-warn"
                      : "text-ok",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    slaState === "breached"
                      ? "bg-crit"
                      : slaState === "at_risk"
                        ? "bg-warn animate-pulse"
                        : "bg-ok",
                  )}
                />
                {formatSla(ticket.sla_deadline)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* LEFT: Issue summary, context, timeline, attachments */}
        <div className="space-y-5 min-w-0">
          {/* Issue Summary */}
          <Panel>
            <PanelHeader title="Issue Summary" />
            <div className="p-4 space-y-3">
              <div>
                <div className="label-caps mb-1">Description</div>
                <p className="text-sm text-foreground leading-relaxed">
                  {ticket.complaints?.detail ||
                    ticket.complaints?.summary ||
                    ticket.title ||
                    "No description available."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-border/60 pt-3">
                <div>
                  <div className="label-caps mb-1">Category</div>
                  <Chip>{formatCategory(ticket.complaints?.category)}</Chip>
                </div>
                <div>
                  <div className="label-caps mb-1">Customer Requested</div>
                  <Chip tone="info">
                    {formatResolution(ticket.complaints?.requested_resolution || "SUPPORT_REVIEW")}
                  </Chip>
                </div>
                <div>
                  <div className="label-caps mb-1">DarkOps Decision</div>
                  <Chip tone={ticket.complaints?.resolution_decision ? "ok" : "warn"}>
                    {formatResolution(
                      ticket.complaints?.resolution_decision || "PENDING_AGENT_REVIEW",
                    )}
                  </Chip>
                </div>
              </div>
              {ticket.complaints?.resolution_decision_reason && (
                <div className="rounded-sm bg-surface-2 p-3 text-xs">
                  <span className="font-semibold text-foreground">Decision Reason: </span>
                  <span className="text-muted-foreground">
                    {ticket.complaints.resolution_decision_reason}
                  </span>
                </div>
              )}
              {ticket.complaints?.execution_handoffs && (
                <div className="rounded-sm bg-primary/5 border border-primary/20 p-3 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-primary">Execution Handoff: </span>
                    <span className="text-muted-foreground">
                      {ticket.complaints.execution_handoffs.resolution_type}
                    </span>
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                      Ref:{" "}
                      {ticket.complaints.execution_handoffs.downstream_reference ||
                        ticket.complaints.execution_handoffs.idempotency_key}
                    </span>
                  </div>
                  <Chip tone="ok">{ticket.complaints.execution_handoffs.status}</Chip>
                </div>
              )}
            </div>
          </Panel>

          {/* Customer / Order Context */}
          {(ticket.customer || ticket.order || ticket.store || ticket.complaints) && (
            <Panel>
              <PanelHeader title="Customer & Order Context" />
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ticket.customer && (
                  <div>
                    <div className="label-caps mb-1">Customer</div>
                    <div className="flex items-center gap-2">
                      <User className="size-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{ticket.customer.full_name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 ml-[22px]">
                      {ticket.customer.email}
                    </div>
                  </div>
                )}
                {ticket.order && (
                  <div>
                    <div className="label-caps mb-1">Order</div>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="size-3.5 text-muted-foreground" />
                      <span className="num text-sm text-foreground">{ticket.order.id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 ml-[22px]">
                      {ticket.order.items_preview ||
                        `${ticket.order.item_count} item${ticket.order.item_count !== 1 ? "s" : ""}`}
                      {ticket.order.total_amount_paise > 0 &&
                        ` · ${formatCurrency(ticket.order.total_amount_paise)}`}
                    </div>
                    <div className="text-xs text-muted-foreground ml-[22px]">
                      Placed: {formatTs(ticket.order.placed_at)}
                    </div>
                  </div>
                )}
                {ticket.store && (
                  <div>
                    <div className="label-caps mb-1">Store</div>
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      <span className="text-sm text-foreground">{ticket.store.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 ml-[22px]">
                      {ticket.store.city} · {ticket.store.id}
                    </div>
                  </div>
                )}
                {ticket.complaints?.refund_amount_paise > 0 && (
                  <div>
                    <div className="label-caps mb-1">Refund Amount</div>
                    <div className="flex items-center gap-2">
                      <Package className="size-3.5 text-muted-foreground" />
                      <span className="num text-sm font-semibold text-foreground">
                        {formatCurrency(ticket.complaints.refund_amount_paise)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Activity Timeline */}
          <Panel>
            <PanelHeader
              title="Activity Timeline"
              right={
                <button
                  onClick={() => setShowNoteForm(!showNoteForm)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80"
                >
                  <MessageSquare className="size-3" />
                  Add note
                </button>
              }
            />

            {/* Note form */}
            {showNoteForm && (
              <div className="border-b border-border p-4 space-y-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add an internal note…"
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => noteMutation.mutate()}
                    disabled={!noteText.trim() || noteMutation.isPending}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {noteMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                    Save note
                  </button>
                  <button
                    onClick={() => {
                      setShowNoteForm(false);
                      setNoteText("");
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="p-4">
              {activity.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity yet.</div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-5">
                    {activity.map((event: any, i: number) => (
                      <div key={event.id} className="flex gap-4 items-start relative">
                        <div className="relative z-10 flex-shrink-0">
                          <EventIcon type={event.event_type} />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="text-sm text-foreground">
                            <EventDescription event={event} />
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {formatTs(event.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Attachments */}
          <Panel>
            <PanelHeader
              title="Attachments"
              right={
                !isResolved &&
                isAssignedToMe && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 disabled:opacity-50"
                  >
                    {uploading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Upload className="size-3" />
                    )}
                    {uploading ? "Uploading…" : "Attach file"}
                  </button>
                )
              }
            />
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFileUpload}
            />
            <div className="p-4">
              {ticket.attachments && ticket.attachments.length > 0 ? (
                <div className="space-y-2">
                  {ticket.attachments.map((att: any) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Paperclip className="size-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">
                            {att.filename}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {att.uploader?.full_name || "Unknown"} ·{" "}
                            {formatRelative(att.uploaded_at)}
                            {att.file_size_bytes &&
                              ` · ${(att.file_size_bytes / 1024).toFixed(1)} KB`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleDownload(att.id, att.filename)}
                          className="text-xs text-primary hover:underline"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${att.filename}?`)) {
                              deleteAttachmentMutation.mutate(att.id);
                            }
                          }}
                          className="text-xs text-destructive hover:underline"
                          disabled={deleteAttachmentMutation.isPending}
                        >
                          {deleteAttachmentMutation.isPending ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No attachments yet.</div>
              )}
            </div>
          </Panel>
        </div>

        {/* RIGHT: Actions, assignment, metadata */}
        <div className="space-y-4">
          {/* Assignment Panel */}
          <Panel>
            <PanelHeader title="Assignment" />
            <div className="p-4 space-y-3">
              <div>
                <div className="label-caps mb-1">Assigned to</div>
                {ticket.assigned_to_profile ? (
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-full bg-surface-3 text-[11px] font-semibold">
                      {ticket.assigned_to_profile.full_name
                        ?.split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {isAssignedToMe ? "You" : ticket.assigned_to_profile.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ticket.assigned_to_profile.email}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Unassigned</div>
                )}
              </div>

              {isLead && !isResolved && (
                <div className="space-y-1.5 pt-2 border-t border-border/60">
                  <div className="label-caps text-xs text-muted-foreground">
                    Reassign Agent (Lead)
                  </div>
                  <select
                    value={ticket.assigned_to || ""}
                    disabled={assignMutation.isPending}
                    onChange={(e) => assignMutation.mutate(e.target.value || null)}
                    className="w-full rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer font-medium"
                  >
                    <option value="">Unassigned</option>
                    {roster.map((agent: any) => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.full_name} {agent.role === "SUPPORT_LEAD" ? "(Lead)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isResolved && !isAssignedToMe && !isLead && (
                <button
                  onClick={() => assignMutation.mutate()}
                  disabled={assignMutation.isPending}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  {assignMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                  Assign to me
                </button>
              )}
            </div>
          </Panel>

          {/* Actions Panel */}
          {!isResolved && isAssignedToMe && (
            <Panel>
              <PanelHeader title="Actions" />
              <div className="p-4 space-y-2">
                {/* Status change */}
                {nextStatuses.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                      disabled={statusMutation.isPending}
                      className="w-full flex items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3 transition-colors disabled:opacity-50"
                    >
                      <span className="font-medium">Change Status</span>
                      {statusMutation.isPending ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )}
                    </button>
                    {statusDropdownOpen && (
                      <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border border-border bg-background shadow-lg">
                        {nextStatuses.map((s) => (
                          <button
                            key={s}
                            onClick={() => statusMutation.mutate(s)}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-surface-2 transition-colors"
                          >
                            → {s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Attach proof */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs hover:bg-surface-3 transition-colors disabled:opacity-50"
                >
                  <Paperclip className="size-3" />
                  {uploading ? "Uploading…" : "Attach proof"}
                </button>

                {/* Resolve */}
                {!showResolveForm ? (
                  <button
                    onClick={() => setShowResolveForm(true)}
                    className="w-full flex items-center gap-2 rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-xs font-medium text-ok hover:bg-ok/20 transition-colors"
                  >
                    <CheckCircle2 className="size-3" />
                    Make Resolution Decision
                  </button>
                ) : (
                  <div className="space-y-3 rounded-md border border-ok/30 bg-ok/5 p-3">
                    <div className="label-caps text-ok">Resolution Decision</div>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { key: "REFUND", label: "Approve Refund" },
                        { key: "REPLACEMENT", label: "Approve Replacement" },
                        { key: "SUPPORT_REVIEW", label: "Support Review" },
                        { key: "NO_ACTION", label: "No Action / Reject" },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setResolutionDecision(opt.key)}
                          className={cn(
                            "rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors",
                            resolutionDecision === opt.key
                              ? "border-ok bg-ok/20 text-ok"
                              : "border-border bg-surface-2 text-muted-foreground hover:bg-surface-3",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="label-caps text-ok mt-2">Resolution Note</div>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Describe the justification for this resolution decision…"
                      rows={3}
                      className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ok/30 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolveMutation.mutate()}
                        disabled={resolutionNote.trim().length < 5 || resolveMutation.isPending}
                        className="flex items-center gap-1.5 rounded-md bg-ok px-3 py-1.5 text-xs font-medium text-ok-soft hover:bg-ok/90 disabled:opacity-50 transition-colors"
                      >
                        {resolveMutation.isPending && <Loader2 className="size-3 animate-spin" />}
                        Confirm Decision
                      </button>
                      <button
                        onClick={() => {
                          setShowResolveForm(false);
                          setResolutionNote("");
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-2"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Resolution summary (if resolved) */}
          {isResolved && ticket.resolution_notes && (
            <Panel>
              <PanelHeader title="Resolution" />
              <div className="p-4 space-y-3">
                <div>
                  <div className="label-caps mb-1">Resolution Note</div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {ticket.resolution_notes}
                  </p>
                </div>
                {ticket.resolved_by_profile && (
                  <div>
                    <div className="label-caps mb-1">Resolved by</div>
                    <div className="text-sm text-foreground">
                      {ticket.resolved_by_profile.full_name}
                    </div>
                  </div>
                )}
                {ticket.resolution_time_minutes && (
                  <div>
                    <div className="label-caps mb-1">Time to resolve</div>
                    <span className="num text-sm text-foreground">
                      {Math.floor(ticket.resolution_time_minutes / 60)}h{" "}
                      {ticket.resolution_time_minutes % 60}m
                    </span>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Ticket metadata */}
          <Panel>
            <PanelHeader title="Details" />
            <div className="p-4 space-y-3">
              {[
                { label: "Queue", value: <Chip>{formatQueue(ticket.queue)}</Chip> },
                { label: "Created", value: formatTs(ticket.created_at) },
                { label: "Last updated", value: formatTs(ticket.updated_at) },
                ticket.sla_deadline && !isResolved
                  ? {
                      label: "SLA deadline",
                      value: (
                        <span
                          className={cn(
                            "text-sm",
                            slaState === "breached"
                              ? "text-crit font-medium"
                              : slaState === "at_risk"
                                ? "text-warn font-medium"
                                : "text-foreground",
                          )}
                        >
                          {formatTs(ticket.sla_deadline)}
                        </span>
                      ),
                    }
                  : null,
                ticket.created_by_profile
                  ? { label: "Created by", value: ticket.created_by_profile.full_name }
                  : null,
              ]
                .filter(Boolean)
                .map((item: any) => (
                  <div key={item.label}>
                    <div className="label-caps mb-0.5">{item.label}</div>
                    <div className="text-sm text-foreground">{item.value}</div>
                  </div>
                ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ─── StatusChip (local copy) ──────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const s = (status || "").toLowerCase();
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
  return <Chip tone={tone}>{formatStatus(status)}</Chip>;
}
