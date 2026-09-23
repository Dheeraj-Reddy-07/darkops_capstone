import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Filter, Search, ArrowLeft } from "lucide-react";
import { Panel, PanelHeader, Chip } from "@/components/ops/primitives";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { formatShortDateTime } from "@/lib/utils";

export const Route = createFileRoute("/admin/security/events")({
  head: () => ({
    meta: [
      { title: "Security Events - DarkOps Admin" },
      {
        name: "description",
        content: "View and filter security events across the system.",
      },
    ],
  }),
  component: SecurityEvents,
});

function SecurityEvents() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: "",
    actor_role: "",
    resource_type: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["security-events", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== "")),
      });
      const response = await fetchApi(`/security/events?${params}`);
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Security Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor security-related events and potential threats
          </p>
        </div>
      </div>

      {/* Filters */}
      <Panel>
        <div className="p-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Actions</option>
              <option value="IDOR_ATTEMPT">IDOR Attempt</option>
              <option value="AUTH_LOGIN_FAILURE">Auth Failure</option>
              <option value="PERMISSION_DENIED">Permission Denied</option>
              <option value="PRIVILEGE_ESCALATION_ATTEMPT">Privilege Escalation</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <select
              value={filters.actor_role}
              onChange={(e) => setFilters({ ...filters, actor_role: e.target.value })}
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Roles</option>
              <option value="PLATFORM_ADMIN">Platform Admin</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="OPERATIONS">Operations</option>
              <option value="CUSTOMER_SUPPORT">Customer Support</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <select
              value={filters.resource_type}
              onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })}
              className="w-full rounded-sm border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Resources</option>
              <option value="order">Order</option>
              <option value="complaint">Complaint</option>
              <option value="case">Case</option>
              <option value="user">User</option>
            </select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ action: "", actor_role: "", resource_type: "" })}
          >
            Clear Filters
          </Button>
        </div>
      </Panel>

      {/* Events Table */}
      <Panel>
        <PanelHeader
          title="Security Events"
          subtitle={`Showing ${data?.pagination?.total || 0} events`}
        />
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-sm text-muted-foreground">Loading events...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-sm text-muted-foreground">Failed to load events</div>
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No security events found
          </div>
        ) : (
          <>
            <div className="divide-y divide-border/70">
              {data?.data?.map((event: any) => (
                <SecurityEventRow key={event.id} event={event} />
              ))}
            </div>
            {/* Pagination */}
            <div className="border-t border-border/70 p-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {data?.pagination?.page} of {data?.pagination?.pages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (data?.pagination?.pages || 1)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function SecurityEventRow({ event }: { event: any }) {
  const actionColors: Record<string, string> = {
    IDOR_ATTEMPT: "text-crit",
    AUTH_LOGIN_FAILURE: "text-warn",
    PERMISSION_DENIED: "text-warn",
    PRIVILEGE_ESCALATION_ATTEMPT: "text-crit",
  };

  const severityColors: Record<string, string> = {
    high: "bg-crit/10 text-crit",
    medium: "bg-warn/10 text-warn",
    low: "bg-ok/10 text-ok",
  };

  const severity =
    event.action === "IDOR_ATTEMPT" || event.action === "PRIVILEGE_ESCALATION_ATTEMPT"
      ? "high"
      : event.action === "AUTH_LOGIN_FAILURE" || event.action === "PERMISSION_DENIED"
        ? "medium"
        : "low";

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Chip tone={severity === "high" ? "crit" : severity === "medium" ? "warn" : "ok"}>
            {severity}
          </Chip>
          <span className={`font-medium ${actionColors[event.action] || "text-foreground"}`}>
            {event.action.replace(/_/g, " ")}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{event.actor_role}</span>
          <span>·</span>
          <span>{event.actor_id?.slice(0, 8)}...</span>
          {event.resource_type && (
            <>
              <span>·</span>
              <span>{event.resource_type}</span>
            </>
          )}
        </div>
      </div>
      <div className="num ml-3 text-xs text-muted-foreground">
        {formatShortDateTime(event.occurred_at)}
      </div>
    </div>
  );
}
