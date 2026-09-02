import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel, PanelHeader, TableShell, Th, Td, EmptyState } from "@/components/ops/primitives";
import { fetchApi } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/audit-logs")({
  head: () => ({
    meta: [
      { title: "Audit logs - DarkOps Admin" },
      { name: "description", content: "Complete platform audit trail of all state-changing operations." },
    ],
  }),
  component: AuditLogsPage,
});

const ACTION_TYPES = [
  "case.assign",
  "case.escalate",
  "case.resolve",
  "fraud.decision",
  "user.role_update",
  "complaint.submit",
  "refund.approve",
  "refund.deny",
];

function useAuditLogs(filter: { action?: string; resource?: string; limit: number }) {
  return useQuery({
    queryKey: ["admin", "audit-logs", filter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(filter.limit) });
      if (filter.action) params.set("action", filter.action);
      if (filter.resource) params.set("resource_type", filter.resource);
      const data = await fetchApi(`/admin/audit-logs?${params.toString()}`);
      return (data.data || []) as Array<{
        id: string;
        action: string;
        actor_id: string;
        actor_role: string;
        resource_type: string;
        resource_id: string;
        occurred_at: string;
        metadata?: Record<string, any>;
      }>;
    },
  });
}

function AuditLogsPage() {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [limit] = useState(100);

  const { data: logs = [], isLoading, error } = useAuditLogs({
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
    limit,
  });

  const filtered = query
    ? logs.filter((l) => {
        const q = query.toLowerCase();
        return (
          l.action.toLowerCase().includes(q) ||
          l.resource_id?.toLowerCase().includes(q) ||
          l.resource_type?.toLowerCase().includes(q) ||
          l.actor_id?.toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <>
      <PageHeader
        title="Audit logs"
        subtitle="Every state-changing operation on the platform with actor, resource and timestamp."
      />

      <Panel>
        <PanelHeader
          title="Event trail"
          subtitle="Immutable record of all mutations. Sorted by most recent first."
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action, resource or actor ID"
              className="w-60 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading audit log…</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-crit">Failed to load audit log.</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No audit events" hint="Try clearing your filters." />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Action</Th>
                <Th>Resource</Th>
                <Th>Resource ID</Th>
                <Th>Actor role</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="row-hover">
                  <Td className="num text-xs text-muted-foreground">
                    {new Date(log.occurred_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour12: false,
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                  <Td className="font-medium text-[13px]">{log.action}</Td>
                  <Td className="label-caps text-[10px] text-muted-foreground">{log.resource_type}</Td>
                  <Td className="num text-xs">{log.resource_id}</Td>
                  <Td>
                    <span className="label-caps text-[10px]">{log.actor_role?.replace(/_/g, " ")}</span>
                  </Td>
                  <Td className="max-w-[200px] truncate text-xs text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata) : "-"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
