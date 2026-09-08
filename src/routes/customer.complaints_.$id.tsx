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

  const [callState, setCallState] = useState<"idle" | "dialing" | "connected" | "ended">("idle");
  const [timer, setTimer] = useState(0);
  const [timerId, setTimerId] = useState<any>(null);

  const startLiveCall = () => {
    setCallState("dialing");
    setTimeout(() => {
      setCallState("connected");
      setTimer(0);
      const interval = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
      setTimerId(interval);
    }, 2000);
  };

  const endLiveCall = () => {
    if (timerId) clearInterval(timerId);
    setCallState("ended");
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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

      {/* Live Agent SLA Escalation Section */}
      {complaint.isLiveCallEligible && (
        <Panel className="border-amber-500/30 bg-amber-500/5">
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <ShieldAlert className="size-5" />
              <p className="text-sm font-semibold">Response SLA Exceeded — Live Support Unlocked</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Your case has exceeded our standard response window ({complaint.slaDueAt || "SLA Window"}). You are now authorized for direct live VoIP support with an operations agent.
            </p>
            {callState === "idle" && (
              <Button onClick={startLiveCall} className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white">
                <PhoneCall className="size-4" /> Connect me to a live agent
              </Button>
            )}

            {callState === "dialing" && (
              <div className="p-4 text-center space-y-2 bg-background rounded-lg border border-border">
                <PhoneCall className="size-6 text-amber-500 animate-bounce mx-auto" />
                <p className="text-xs font-semibold">Connecting to senior support agent...</p>
                <Button variant="outline" size="sm" onClick={endLiveCall} className="text-crit text-xs">
                  Cancel Call
                </Button>
              </div>
            )}

            {callState === "connected" && (
              <div className="p-4 space-y-3 bg-background rounded-lg border border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-xs font-bold text-emerald-400">Connected to Senior Agent</span>
                  </div>
                  <span className="num text-xs font-mono">{formatTimer(timer)}</span>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  "Hello! I am reviewing your complaint ({complaint.complaintRef}) for order {complaint.orderId}. Processing your priority resolution right now."
                </p>
                <Button variant="destructive" size="sm" onClick={endLiveCall} className="w-full gap-2 text-xs">
                  <PhoneOff className="size-4" /> End Call
                </Button>
              </div>
            )}

            {callState === "ended" && (
              <div className="p-3 text-center space-1 bg-background rounded-lg border border-border">
                <p className="text-xs font-semibold text-foreground">Call Ended ({formatTimer(timer)})</p>
                <p className="text-[11px] text-muted-foreground">Call summary & audio recording attached to case history.</p>
              </div>
            )}
          </div>
        </Panel>
      )}

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
