import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  KpiCard,
  Panel,
  PanelHeader,
  Chip,
  EmptyState,
  ErrorState,
} from "@/components/ops/primitives";
import { fetchApi } from "@/lib/api";
import { num, formatShortDateTime } from "@/lib/utils";
import { humanizeAction, actionTone, humanizeRole } from "@/lib/admin-format";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console - DarkOps" },
      {
        name: "description",
        content: "Platform governance, access management, security, and audit.",
      },
    ],
  }),
  component: AdminOverview,
});

interface AdminStats {
  users: number;
  active_users: number;
  stores: number;
  active_stores: number;
  recent_audit_events: number;
}

interface SecuritySummary {
  total: number;
  passing: number;
  partial: number;
  failing: number;
  unknown: number;
}

interface AuditEvent {
  id: string;
  action: string;
  actor_id: string;
  actor_role: string;
  resource_type: string;
  resource_id: string;
  occurred_at: string;
  metadata?: Record<string, any>;
}

function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => (await fetchApi("/admin/stats")) as AdminStats,
  });
}

function useSecuritySummary() {
  return useQuery({
    queryKey: ["admin", "security-summary"],
    queryFn: async () => {
      const res = await fetchApi("/security/overview");
      return res.data.summary as SecuritySummary;
    },
  });
}

function useRecentAuditLogs() {
  return useQuery({
    queryKey: ["admin", "audit-logs", "recent"],
    queryFn: async () => {
      const res = await fetchApi("/admin/audit-logs?limit=8");
      return (res.data || []) as AuditEvent[];
    },
  });
}

function AdminOverview() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: security, isLoading: securityLoading } = useSecuritySummary();
  const { data: logs, isLoading: logsLoading, error: logsError, refetch } = useRecentAuditLogs();

  const attention = security ? security.partial + security.failing + security.unknown : 0;

  return (
    <>
      <PageHeader
        title="Admin Console"
        subtitle="Platform governance, access management, security, and audit."
        right={
          <span className="label-caps rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Shield className="mr-1 inline size-3" />
            Platform Admin
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          loading={statsLoading}
          value={num(stats?.users ?? 0)}
          footnote="registered profiles"
        />
        <KpiCard
          label="Active users"
          loading={statsLoading}
          value={num(stats?.active_users ?? 0)}
          tone="ok"
          footnote={
            statsLoading
              ? "enabled accounts"
              : `${num((stats?.users ?? 0) - (stats?.active_users ?? 0))} deactivated`
          }
        />
        <KpiCard
          label="Dark stores"
          loading={statsLoading}
          value={num(stats?.stores ?? 0)}
          footnote={statsLoading ? "network stores" : `${num(stats?.active_stores ?? 0)} active`}
        />
        <KpiCard label="Security controls" tone={attention > 0 ? "warn" : "ok"}>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`num text-[28px] font-semibold leading-none ${attention > 0 ? "text-warn" : "text-ok"}`}
            >
              {securityLoading || !security ? "—" : `${security.passing}/${security.total}`}
            </span>
            <span className="text-xs text-muted-foreground">passing</span>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground">
            {securityLoading || !security ? (
              "verifying controls"
            ) : attention > 0 ? (
              <Link to="/admin/security" className="text-warn hover:underline">
                {attention} need attention
              </Link>
            ) : (
              <Link to="/admin/security" className="hover:text-foreground">
                all controls verified
              </Link>
            )}
          </div>
        </KpiCard>
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="Recent audit events"
          subtitle="Latest platform mutations with actor, resource, and timestamp."
          right={
            <Link
              to="/admin/audit-logs"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View all <ChevronRight className="size-3.5" />
            </Link>
          }
        />
        {logsLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading audit events…</div>
        ) : logsError ? (
          <ErrorState
            title="Could not load audit events"
            hint="The audit feed did not respond."
            onRetry={() => refetch()}
          />
        ) : !logs?.length ? (
          <EmptyState
            title="No recent platform activity"
            hint="Administrative actions and platform mutations will appear here."
          />
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="label-caps px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Event
                </th>
                <th className="label-caps px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Actor
                </th>
                <th className="label-caps px-4 py-2.5 text-left font-medium text-muted-foreground">
                  Resource
                </th>
                <th className="label-caps px-4 py-2.5 text-right font-medium text-muted-foreground">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Chip tone={actionTone(log.action)}>{humanizeAction(log.action)}</Chip>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {humanizeRole(log.actor_role)}
                  </td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">
                    {log.resource_type}
                    {log.resource_id ? `/${log.resource_id}` : ""}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-xs text-muted-foreground">
                    {formatShortDateTime(log.occurred_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
