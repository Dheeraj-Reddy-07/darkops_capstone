import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ArrowLeft,
  FileText,
  Paperclip,
  MessageSquare,
} from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useCustomerComplaintById } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/complaints_/$id")({
  head: () => ({
    meta: [
      { title: "Complaint details - DarkOps Care" },
      {
        name: "description",
        content: "View complaint status, timeline, and resolution details.",
      },
    ],
  }),
  component: ComplaintDetail,
});

function ComplaintDetail() {
  const { id } = useParams({ from: "/customer/complaints_/$id" });
  const { data: complaint, isLoading, error } = useCustomerComplaintById(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading complaint details...</div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Complaint not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This complaint may not exist or you don't have permission to view it.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/customer">Back to home</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  const getCustomerFriendlyStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      unassigned: "Received",
      assigned: "Under Review",
      in_progress: "In Progress",
      awaiting_customer: "Waiting for Your Response",
      resolved: "Resolved",
      closed: "Closed",
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    if (status === "resolved" || status === "closed") return "text-ok";
    if (status === "in_progress" || status === "assigned") return "text-warn";
    return "text-muted-foreground";
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer/complaints">
            <ArrowLeft className="mr-2 size-4" />
            Back to complaints
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Complaint details</h1>
          <p className="text-xs text-muted-foreground">{complaint.complaintRef}</p>
        </div>
      </div>

      {/* Complaint Summary */}
      <Panel>
        <PanelHeader
          title={complaint.summary}
          subtitle={`Order ${complaint.orderId} · ${complaint.storeName || "Unknown store"}`}
          right={<StatusBadge status={complaint.status} />}
        />
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[13px] font-medium">Description</p>
            <p className="mt-1 text-sm text-muted-foreground">{complaint.detail}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px]">Submitted on</p>
                <p className="num text-xs text-muted-foreground">{complaint.createdAt}</p>
              </div>
            </div>
            {complaint.orderValue && (
              <div className="flex items-start gap-3">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[13px]">Order value</p>
                  <p className="num text-xs text-muted-foreground">{inr(complaint.orderValue)}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <AlertCircle className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px]">Category</p>
                <p className="num text-xs text-muted-foreground capitalize">
                  {complaint.category.replace("_", " ")}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[13px]">Priority</p>
                <p className="num text-xs text-muted-foreground">{complaint.priority}</p>
              </div>
            </div>
          </div>

          {complaint.resolution && (
            <div className="rounded-sm bg-ok/10 border border-ok/20 p-3">
              <p className="text-[13px] font-medium text-ok">Resolution</p>
              <p className="mt-1 text-sm text-muted-foreground">{complaint.resolution}</p>
            </div>
          )}
        </div>
      </Panel>

      {/* Attachments */}
      {complaint.attachments && complaint.attachments.length > 0 && (
        <Panel>
          <PanelHeader
            title="Attachments"
            subtitle={`${complaint.attachments.length} file${complaint.attachments.length > 1 ? "s" : ""}`}
          />
          <div className="p-4 space-y-2">
            {complaint.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-3 rounded-sm bg-surface-2 px-3 py-2"
              >
                <Paperclip className="size-4 text-muted-foreground" />
                <span className="text-[13px]">{attachment.filename}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {attachment.uploadedAt}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Status Timeline */}
      <Panel>
        <PanelHeader title="Status timeline" subtitle="Track your complaint progress" />
        <ol className="p-4">
          {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
            complaint.statusHistory.map((history, index) => (
              <li key={index} className="flex gap-3 pb-4 last:pb-0">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full",
                      index === 0 ? "bg-ok/10" : "bg-surface-2",
                    )}
                  >
                    {index === 0 ? (
                      <CheckCircle2 className="size-4 text-ok" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  {index < complaint.statusHistory!.length - 1 && (
                    <span className="mt-2 w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="-mt-1">
                  <p className="text-[13px] font-medium">
                    {getCustomerFriendlyStatus(history.toStatus)}
                  </p>
                  <p className="num text-xs text-muted-foreground">{history.changedAt}</p>
                  {history.note && (
                    <p className="mt-1 text-xs text-muted-foreground italic">{history.note}</p>
                  )}
                </div>
              </li>
            ))
          ) : (
            <li className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="flex size-8 items-center justify-center rounded-full bg-surface-2">
                  <Circle className="size-4 text-muted-foreground" />
                </div>
              </div>
              <div className="-mt-1">
                <p className="text-[13px] font-medium">
                  {getCustomerFriendlyStatus(complaint.status)}
                </p>
                <p className="num text-xs text-muted-foreground">{complaint.createdAt}</p>
              </div>
            </li>
          )}
        </ol>
      </Panel>

      {/* Current Status */}
      <Panel>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full",
                complaint.status === "resolved" || complaint.status === "closed"
                  ? "bg-ok/10"
                  : "bg-warn/10",
              )}
            >
              {complaint.status === "resolved" || complaint.status === "closed" ? (
                <CheckCircle2 className="size-4 text-ok" />
              ) : (
                <Clock className="size-4 text-warn" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Current status</p>
              <p className={cn("mt-1 text-sm", getStatusColor(complaint.status))}>
                {getCustomerFriendlyStatus(complaint.status)}
              </p>
              {complaint.status === "awaiting_customer" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  We need more information to resolve your complaint. Please check your email or
                  contact support.
                </p>
              )}
              {complaint.status === "resolved" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Your complaint has been resolved. If you have any further questions, please
                  contact support.
                </p>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Actions */}
      <Panel>
        <div className="p-4">
          <p className="text-sm font-medium">Need more help?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you have additional information or questions about this complaint, our support team
            is here to help.
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" className="flex-1">
              <Link to="/customer/support">Report new issue</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/customer">Back to home</Link>
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
