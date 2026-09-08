import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Filter, ArrowLeft } from "lucide-react";
import { Panel, PanelHeader, Chip } from "@/components/ops/primitives";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/security/user-activity")({
  head: () => ({
    meta: [
      { title: "User Activity - DarkOps Admin" },
      {
        name: "description",
        content: "Monitor user activities and access patterns.",
      },
    ],
  }),
  component: UserActivity,
});

function UserActivity() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    role: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-activity", page, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "50",
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== "")),
      });
      const response = await fetchApi(`/security/user-activity?${params}`);
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
          <h1 className="text-2xl font-semibold tracking-tight">User Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor user activities and access patterns
          </p>
        </div>
      </div>

      {/* Filters */}
      <Panel>
        <div className="p-4 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <select
              value={filters.role}
              onChange={(e) => setFilters({ ...filters, role: e.target.value })}
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
          <Button variant="outline" size="sm" onClick={() => setFilters({ role: "" })}>
            Clear Filters
          </Button>
        </div>
      </Panel>

      {/* User Summary */}
      {data?.summary && data.summary.length > 0 && (
        <Panel>
          <PanelHeader title="User Summary" subtitle="Activity by user" />
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {data.summary.map((user: any) => (
                <UserSummaryCard key={user.user_id} user={user} />
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* Activity Table */}
      <Panel>
        <PanelHeader
          title="Recent Activity"
          subtitle={`Showing ${data?.pagination?.total || 0} entries`}
        />
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-sm text-muted-foreground">Loading activity...</div>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-sm text-muted-foreground">Failed to load activity</div>
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No activity found</div>
        ) : (
          <>
            <div className="divide-y divide-border/70">
              {data?.data?.map((activity: any) => (
                <ActivityRow key={activity.id} activity={activity} />
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

function UserSummaryCard({ user }: { user: any }) {
  const roleColors: Record<string, string> = {
    PLATFORM_ADMIN: "bg-purple-100 text-purple-700",
    EXECUTIVE: "bg-blue-100 text-blue-700",
    OPERATIONS: "bg-green-100 text-green-700",
    CUSTOMER_SUPPORT: "bg-orange-100 text-orange-700",
    CUSTOMER: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="rounded-sm border border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{user.user_id.slice(0, 8)}...</div>
          <Chip className={roleColors[user.role] || "bg-gray-100 text-gray-700"}>{user.role}</Chip>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold">{user.action_count}</div>
          <div className="text-xs text-muted-foreground">actions</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Last active: {format(new Date(user.last_activity), "dd MMM, HH:mm")}
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: any }) {
  const actionColors: Record<string, string> = {
    AUTH_LOGIN_SUCCESS: "text-ok",
    AUTH_LOGIN_FAILURE: "text-warn",
    COMPLAINT_CREATED: "text-foreground",
    COMPLAINT_ESCALATED: "text-warn",
    CASE_ASSIGNED: "text-foreground",
    CASE_STATUS_CHANGED: "text-foreground",
  };

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${actionColors[activity.action] || "text-foreground"}`}>
            {activity.action.replace(/_/g, " ")}
          </span>
          {activity.resource_type && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{activity.resource_type}</span>
            </>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{activity.actor_role}</span>
          <span>·</span>
          <span>{activity.actor_id?.slice(0, 8)}...</span>
        </div>
      </div>
      <div className="ml-3 text-xs text-muted-foreground">
        {format(new Date(activity.created_at), "dd MMM, HH:mm")}
      </div>
    </div>
  );
}
