import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Shield, Users, Database, FileText, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard, Panel, PanelHeader } from "@/components/ops/primitives";
import { fetchApi } from "@/lib/api";
import { num } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin console — DarkOps" },
      { name: "description", content: "System administration dashboard for DarkOps platform." },
    ],
  }),
  component: AdminOverview,
});

function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const data = await fetchApi("/admin/stats");
      return data as {
        users: number;
        stores: number;
        complaints: number;
        fraud_reviews: number;
      };
    },
  });
}

function useRecentAuditLogs() {
  return useQuery({
    queryKey: ["admin", "audit-logs", "recent"],
    queryFn: async () => {
      const data = await fetchApi("/admin/audit-logs?limit=10");
      return (data.data || []) as Array<{
        id: string;
        action: string;
        actor_id: string;
        resource_type: string;
        resource_id: string;
        occurred_at: string;
        actor_role: string;
      }>;
    },
  });
}

function AdminOverview() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: logs, isLoading: logsLoading } = useRecentAuditLogs();

  return (
    <>
      <PageHeader
        title="Admin console"
        subtitle="Platform overview · user management · audit logs · system configuration"
        right={
          <span className="label-caps rounded-sm border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary">
            <Shield className="mr-1 inline size-3" />
            Admin
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          value={statsLoading ? "—" : num(stats?.users || 0)}
          footnote="registered profiles"
        >
          <Users className="mt-1 size-6 text-muted-foreground" />
        </KpiCard>
        <KpiCard
          label="Dark stores"
          value={statsLoading ? "—" : num(stats?.stores || 0)}
          footnote="network stores"
        >
          <Database className="mt-1 size-6 text-muted-foreground" />
        </KpiCard>
        <KpiCard
          label="Total complaints"
          value={statsLoading ? "—" : num(stats?.complaints || 0)}
          footnote="all time"
        >
          <FileText className="mt-1 size-6 text-muted-foreground" />
        </KpiCard>
        <KpiCard
          label="Fraud reviews"
          value={statsLoading ? "—" : num(stats?.fraud_reviews || 0)}
          footnote="flagged claims"
        >
          <TrendingUp className="mt-1 size-6 text-muted-foreground" />
        </KpiCard>
      </div>

      <Panel className="mt-3">
        <PanelHeader
          title="Recent audit events"
          subtitle="Latest platform mutations with actor and timestamp."
        />
        {logsLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading audit log…</div>
        ) : !logs?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No audit events yet.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Time</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Action</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Resource</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Role</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-surface-2">
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(log.occurred_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}
                  </td>
                  <td className="px-4 py-2.5 font-medium">{log.action}</td>
                  <td className="num px-4 py-2.5 text-xs text-muted-foreground">
                    {log.resource_type}/{log.resource_id}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="label-caps text-[10px]">{log.actor_role}</span>
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
