import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Clock,
  AlertCircle,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  FileText,
  Zap,
} from "lucide-react";
import { Panel, PanelHeader, StatusBadge, Chip } from "@/components/ops/primitives";
import { useCustomerComplaints, useCustomerProfile } from "@/hooks/useCustomer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/customer/")({
  head: () => ({
    meta: [
      { title: "Home - DarkOps Care" },
      {
        name: "description",
        content: "Your quick-commerce support hub - track issues and request resolution.",
      },
      { property: "og:title", content: "Home - DarkOps Care" },
      {
        property: "og:description",
        content: "Track issues and request resolution.",
      },
    ],
  }),
  component: CustomerHome,
});

function CustomerHome() {
  const {
    data: complaintsData,
    isLoading: complaintsLoading,
    error: complaintsError,
  } = useCustomerComplaints();
  const { data: profile } = useCustomerProfile();

  const activeComplaints =
    complaintsData?.filter((c: any) => c.status !== "resolved" && c.status !== "closed") || [];
  const resolvedComplaints =
    complaintsData?.filter((c: any) => c.status === "resolved" || c.status === "closed") || [];

  const calculateAvgResolutionTime = () => {
    if (!resolvedComplaints || resolvedComplaints.length === 0) return "N/A";
    let totalMins = 0;
    let validCount = 0;

    for (const c of resolvedComplaints) {
      if (c.rawCreatedAt && c.rawUpdatedAt) {
        const createdMs = new Date(c.rawCreatedAt).getTime();
        const updatedMs = new Date(c.rawUpdatedAt).getTime();
        if (updatedMs > createdMs) {
          totalMins += Math.round((updatedMs - createdMs) / (60 * 1000));
          validCount++;
        }
      }
    }

    if (validCount === 0) return "N/A";
    const avgMins = Math.round(totalMins / validCount);
    if (avgMins < 60) return `${avgMins} min${avgMins !== 1 ? "s" : ""}`;
    return `${(avgMins / 60).toFixed(1)} hrs`;
  };

  if (complaintsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-sm text-muted-foreground">Loading your issue hub...</div>
      </div>
    );
  }

  if (complaintsError) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Panel className="p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold text-foreground">Unable to load data</h1>
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="w-full space-y-5">
      {/* Welcome Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {getGreeting()}, {profile?.full_name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            DarkOps Exception Tracking & Issue Resolution Center
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/customer/orders">
              <AlertCircle className="mr-2 size-4 text-warn" />
              Report an Issue
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/customer/chat">
              <MessageSquare className="mr-2 size-4" />
              AI Assistant
            </Link>
          </Button>
        </div>
      </div>

      {/* Customer Issue History KPI Strip (Real DB-backed metrics for authenticated customer) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Card 1: Total Issues Reported */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Issues Reported</span>
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="num text-3xl font-bold tracking-tight text-foreground">
              {complaintsData?.length || 0}
            </span>
            <span className="text-xs text-muted-foreground">lifetime</span>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            Customer exception history
          </p>
        </Panel>

        {/* Card 2: Active / Open Issues */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Issues</span>
            <Clock className="size-4 text-warn" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="num text-3xl font-bold tracking-tight text-warn">
              {activeComplaints.length}
            </span>
            {activeComplaints.length > 0 ? (
              <Chip tone="warn">In Review</Chip>
            ) : (
              <Chip tone="ok">Clear</Chip>
            )}
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            {activeComplaints.length > 0
              ? `${activeComplaints.length} issue${activeComplaints.length > 1 ? "s" : ""} in progress`
              : "Zero active issues"}
          </p>
        </Panel>

        {/* Card 3: Resolved Issues */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Resolved Issues</span>
            <CheckCircle2 className="size-4 text-ok" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="num text-3xl font-bold tracking-tight text-ok">
              {resolvedComplaints.length}
            </span>
            <span className="text-xs text-muted-foreground">closed</span>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">Completed resolutions</p>
        </Panel>

        {/* Card 4: Average Resolution Time */}
        <Panel className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Avg. Resolution Time</span>
            <Zap className="size-4 text-primary" />
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="num text-3xl font-bold tracking-tight text-foreground">
              {calculateAvgResolutionTime()}
            </span>
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
            Across resolved complaints
          </p>
        </Panel>
      </div>

      {/* Open Issues Detail Panel */}
      <Panel>
        <PanelHeader
          title="Open Issues Detail"
          subtitle={
            activeComplaints.length > 0
              ? `${activeComplaints.length} active issue${activeComplaints.length > 1 ? "s" : ""} being processed`
              : "No open issues"
          }
          right={
            complaintsData &&
            complaintsData.length > 0 && (
              <Button asChild variant="ghost" size="sm" className="text-xs">
                <Link to="/customer/complaints">View all issues</Link>
              </Button>
            )
          }
        />
        {activeComplaints.length > 0 ? (
          <div className="divide-y divide-border/60">
            {activeComplaints.map((complaint: any) => (
              <div
                key={complaint.id}
                className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground">{complaint.summary}</p>
                    <StatusBadge status={complaint.customerStatusLabel || complaint.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reference:{" "}
                    <span className="font-mono text-foreground">{complaint.complaintRef}</span> ·
                    Order: <span className="font-mono text-foreground">{complaint.orderId}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Reported on {complaint.createdAt}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="h-8 text-xs shrink-0">
                  <Link to="/customer/complaints/$id" params={{ id: complaint.id }}>
                    Track issue
                    <ArrowRight className="ml-1.5 size-3" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            <CheckCircle2 className="mx-auto size-8 text-ok mb-2" />
            <p className="font-medium text-foreground text-sm">No open issues</p>
            <p className="mt-1">All reported issues have been resolved.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}
