import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ArrowLeft,
  FileText,
  Paperclip,
  MessageSquare,
  Phone,
  PhoneCall,
  PhoneOff,
  ShieldAlert,
} from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useCustomerComplaintById } from "@/hooks/useCustomer";
import { inr, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { LiveSupportCallOverlay } from "@/components/customer/LiveSupportCallOverlay";

export const Route = createFileRoute("/customer/complaints_/$id")({
  head: () => ({
    meta: [
      { title: "Issue details - DarkOps Care" },
      {
        name: "description",
        content: "View issue status, timeline, and resolution details.",
      },
    ],
  }),
  component: ComplaintDetail,
});

function ComplaintDetail() {
  const { id } = useParams({ from: "/customer/complaints_/$id" });
  const { data: complaint, isLoading, error } = useCustomerComplaintById(id);

  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);

  const handleCallClose = (status: string) => {
    setShowCallOverlay(false);
    if (status === "ended") {
      setCallStatus("completed");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading issue details...</div>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Issue not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This issue may not exist or you don't have permission to view it.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/customer">Back to home</Link>
          </Button>
        </Panel>
      </div>
    );
  }

  const getCustomerFriendlyStatus = (status: string, overrideLabel?: string) => {
    if (overrideLabel) return overrideLabel;
    const rawStatus = (status || "").toLowerCase();
    const statusMap: Record<string, string> = {
      received: "Complaint received",
      unassigned: "Complaint received",
      agent_queue: "Under review",
      assigned: "Under review",
      in_progress: "Being resolved",
      auto_resolved: "Resolved automatically",
      resolved: "Resolved",
      closed: "Resolved",
      sla_expired: "Support available",
      awaiting_customer: "Waiting for response",
    };
    return statusMap[rawStatus] || "Under review";
  };

  const formatCategory = (cat: string) => {
    const categoryMap: Record<string, string> = {
      wrong_item: "Wrong item received",
      missing_item: "Missing item",
      damaged_item: "Damaged item",
      quality_issue: "Quality issue",
      late_delivery: "Late delivery",
      payment_issue: "Payment or refund issue",
      other: "Other",
    };
    return categoryMap[cat] || cat.replace(/_/g, " ");
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
            Back to My Issues
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Issue details</h1>
          <p className="text-xs text-muted-foreground">{complaint.complaintRef}</p>
        </div>
      </div>

      {/* Complaint Summary */}
      <Panel>
        <PanelHeader
          title={complaint.summary}
          subtitle={`Order ${complaint.orderId} · ${complaint.storeName || "Store order"}`}
          right={<StatusBadge status={getCustomerFriendlyStatus(complaint.status, complaint.customerStatusLabel)} />}
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
                <p className="text-[13px]">Reported on</p>
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
                <p className="text-[13px]">Issue type</p>
                <p className="num text-xs text-muted-foreground">
                  {formatCategory(complaint.category)}
                </p>
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
        <PanelHeader title="Status timeline" subtitle="Track your issue resolution" />
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
                    {getCustomerFriendlyStatus(history.toStatus, undefined)}
                  </p>
                  <p className="num text-xs text-muted-foreground">{history.changedAt}</p>
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
                  {getCustomerFriendlyStatus(complaint.status, complaint.customerStatusLabel)}
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
              <p className={cn("mt-1 text-sm font-medium", getStatusColor(complaint.status))}>
                {getCustomerFriendlyStatus(complaint.status, complaint.customerStatusLabel)}
              </p>
              {/* Show backend-computed detail text if available */}
              {complaint.customerStatusDetail && (
                <p className="mt-1 text-xs text-muted-foreground">{complaint.customerStatusDetail}</p>
              )}
              {complaint.status === "awaiting_customer" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  We need a bit more information to resolve your issue. Please check your email or messages.
                </p>
              )}
            </div>
          </div>
        </div>
      </Panel>

      {/* Live Agent SLA Escalation Section */}
      {complaint.isLiveCallEligible && (
        <Panel className={cn(callStatus === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5")}>
          <div className="p-4 space-y-3">
            {callStatus === "completed" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-500 font-semibold text-sm">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <span>Support Call Completed</span>
                </div>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-500/10 p-3 rounded-md border border-emerald-500/20">
                  You have completed a support call with our agent. Your issue has been updated.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-amber-500">
                  <ShieldAlert className="size-5" />
                  <p className="text-sm font-semibold">Response window exceeded · Live support available</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Our team is taking longer than usual to resolve your issue. You are now eligible to speak directly with an agent via live voice support.
                </p>
                <Button onClick={() => setShowCallOverlay(true)} disabled={showCallOverlay} className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                  <PhoneCall className="size-4" /> Connect with live support
                </Button>
              </>
            )}
          </div>
        </Panel>
      )}

      {showCallOverlay && (
        <LiveSupportCallOverlay
          complaintRef={complaint.complaintRef}
          orderId={complaint.orderId}
          onClose={handleCallClose}
        />
      )}

      {/* Actions */}
      <Panel>
        <div className="p-4">
          <p className="text-sm font-medium">Need help with another order?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            View your recent orders to report a new issue or track your active deliveries.
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" className="flex-1">
              <Link to="/customer/orders">View orders</Link>
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
