import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, AlertCircle, Filter, ArrowRight, PackageSearch } from "lucide-react";
import { Panel, PanelHeader, StatusBadge } from "@/components/ops/primitives";
import { useCustomerComplaints } from "@/hooks/useCustomer";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/complaints/")({
  head: () => ({
    meta: [
      { title: "My Issues - DarkOps Care" },
      {
        name: "description",
        content: "Track your reported issues and their resolution status.",
      },
    ],
  }),
  component: ComplaintHistory,
});

function ComplaintHistory() {
  const { data: complaints, isLoading, error } = useCustomerComplaints();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredComplaints =
    complaints?.filter((c: any) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "open") return c.status !== "resolved" && c.status !== "closed";
      if (statusFilter === "resolved") return c.status === "resolved" || c.status === "closed";
      return c.status === statusFilter;
    }) || [];

  const allCount = complaints?.length || 0;
  const activeCount =
    complaints?.filter((c: any) => c.status !== "resolved" && c.status !== "closed").length || 0;
  const resolvedCount =
    complaints?.filter((c: any) => c.status === "resolved" || c.status === "closed").length || 0;

  const getCustomerFriendlyStatus = (complaint: any) => {
    if (complaint.customerStatusLabel) return complaint.customerStatusLabel;
    const rawStatus = (complaint.status || "").toLowerCase().replace(/_/g, " ");
    const statusMap: Record<string, string> = {
      received: "Complaint received",
      unassigned: "Complaint received",
      agent_queue: "Under review",
      assigned: "Under review",
      in_progress: "Being resolved",
      refund_in_progress: "Refund in progress",
      auto_resolved: "Resolved automatically",
      resolved: "Resolved",
      closed: "Resolved",
      sla_expired: "Support available",
      awaiting_customer: "Waiting for response",
    };
    return statusMap[rawStatus] || rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading your reported issues...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Unable to load issues</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please check your connection and try again.
          </p>
          <Button onClick={() => window.location.reload()} size="sm" className="mt-4">
            Retry
          </Button>
        </Panel>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/customer">
            <ArrowRight className="mr-2 size-4 rotate-180" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">My Issues</h1>
          <p className="text-xs text-muted-foreground">
            {allCount} total reported issue{allCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <Panel>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="size-4 text-muted-foreground" />
            <p className="text-[13px] font-medium">Filter by status</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: `All (${allCount})` },
              { value: "open", label: `Active (${activeCount})` },
              { value: "resolved", label: `Resolved (${resolvedCount})` },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "rounded-sm border px-3 py-1.5 text-[13px] transition-colors",
                  statusFilter === filter.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface-2 hover:border-primary/40",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      {/* Complaints List */}
      {filteredComplaints.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Reported Issues"
            subtitle={`${filteredComplaints.length} issue${filteredComplaints.length > 1 ? "s" : ""} found`}
          />
          <ul className="divide-y divide-border/60">
            {filteredComplaints.map((complaint: any) => (
              <li key={complaint.id}>
                <Link
                  to="/customer/complaints/$id"
                  params={{ id: complaint.id }}
                  className="block border-b border-border/70 px-4 py-4 last:border-0 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="num text-[13px]">{complaint.complaintRef}</p>
                        <StatusBadge status={getCustomerFriendlyStatus(complaint)} />
                      </div>
                      <p className="text-sm font-medium">{complaint.summary}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Order {complaint.orderId} · {complaint.storeName || "Store order"}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span>{complaint.createdAt}</span>
                      </div>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : (
        <Panel>
          <div className="p-8 text-center">
            <PackageSearch className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              {statusFilter === "all"
                ? "No issues reported yet"
                : `No issues with status "${statusFilter}"`}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/customer/orders">View orders to report an issue</Link>
            </Button>
          </div>
        </Panel>
      )}

      {/* Summary Stats */}
      {complaints && complaints.length > 0 && (
        <Panel>
          <PanelHeader title="Summary" subtitle="Overview of your reported issues" />
          <div className="grid gap-4 p-4 sm:grid-cols-3">
            <div className="text-center">
              <p className="text-2xl font-semibold">{complaints.length}</p>
              <p className="text-xs text-muted-foreground">Total reported</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-warn">
                {
                  complaints.filter((c: any) => c.status !== "resolved" && c.status !== "closed")
                    .length
                }
              </p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-ok">
                {
                  complaints.filter((c: any) => c.status === "resolved" || c.status === "closed")
                    .length
                }
              </p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
