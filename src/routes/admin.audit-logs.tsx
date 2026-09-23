import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Panel,
  PanelHeader,
  TableShell,
  Th,
  Td,
  Chip,
  EmptyState,
  ErrorState,
} from "@/components/ops/primitives";
import { fetchApi } from "@/lib/api";
import { formatShortDateTime, formatDateTime } from "@/lib/utils";
import { humanizeAction, actionTone, humanizeRole } from "@/lib/admin-format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
      { title: "Audit Logs - DarkOps Admin" },
      {
        name: "description",
        content: "Complete platform audit trail of all state-changing operations.",
      },
    ],
  }),
  component: AuditLogsPage,
});

// Actions the DarkOps application actually emits, grouped for the filter.
const ACTION_TYPES = [
  "USER_ROLE_CHANGED",
  "USER_DEACTIVATED",
  "USER_REACTIVATED",
  "PROFILE_UPDATED",
  "SETTINGS_UPDATED",
  "STORE_UPDATED",
  "COMPLAINT_CREATED",
  "COMPLAINT_ESCALATED",
  "COMPLAINT_RESOLVED",
  "CASE_ASSIGNED",
  "CASE_STATUS_CHANGED",
  "ATTACHMENT_UPLOADED",
  "PERMISSION_DENIED",
  "IDOR_ATTEMPT",
  "PRIVILEGE_ESCALATION_ATTEMPT",
  "AUTH_LOGIN_FAILURE",
];

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

function useAuditLogs(filter: { action?: string; limit: number }) {
  return useQuery({
    queryKey: ["admin", "audit-logs", filter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(filter.limit) });
      if (filter.action) params.set("action", filter.action);
      const data = await fetchApi(`/admin/audit-logs?${params.toString()}`);
      return (data.data || []) as AuditEvent[];
    },
  });
}

function AuditLogsPage() {
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState<AuditEvent | null>(null);

  const {
    data: logs = [],
    isLoading,
    error,
    refetch,
  } = useAuditLogs({
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
    limit: 150,
  });

  const filtered = query
    ? logs.filter((l) => {
        const q = query.toLowerCase();
        return (
          l.action?.toLowerCase().includes(q) ||
          humanizeAction(l.action).toLowerCase().includes(q) ||
          l.resource_id?.toLowerCase().includes(q) ||
          l.resource_type?.toLowerCase().includes(q) ||
          l.actor_id?.toLowerCase().includes(q) ||
          l.actor_role?.toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="Every state-changing operation on the platform, with actor, resource, and timestamp."
      />

      <Panel>
        <PanelHeader
          title="Event trail"
          subtitle={
            isLoading ? "Loading…" : `${filtered.length} events · newest first · append-only`
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          <div className="flex h-8 items-center gap-2 rounded-sm border border-border bg-surface-2 px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search action, resource, or actor"
              className="w-64 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="Action type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {humanizeAction(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading audit log…</div>
        ) : error ? (
          <ErrorState
            title="Failed to load audit log"
            hint="The audit feed did not respond."
            onRetry={() => refetch()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No audit events"
            hint={
              query || actionFilter !== "all"
                ? "Try clearing your search or filters."
                : "State-changing operations will appear here as they happen."
            }
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>Event</Th>
                <Th>Actor</Th>
                <Th>Resource</Th>
                <Th align="right">Details</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  className="row-hover cursor-pointer"
                  onClick={() => setSelected(log)}
                >
                  <Td className="num whitespace-nowrap text-xs text-muted-foreground">
                    {formatShortDateTime(log.occurred_at)}
                  </Td>
                  <Td>
                    <Chip tone={actionTone(log.action)}>{humanizeAction(log.action)}</Chip>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{humanizeRole(log.actor_role)}</Td>
                  <Td className="num text-xs text-muted-foreground">
                    {log.resource_type}
                    {log.resource_id ? `/${log.resource_id}` : ""}
                  </Td>
                  <Td align="right" className="text-xs text-primary">
                    View
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {humanizeAction(selected.action)}
                  <Chip tone={actionTone(selected.action)}>{selected.action}</Chip>
                </DialogTitle>
                <DialogDescription>
                  Recorded {formatDateTime(selected.occurred_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <Field label="Actor role" value={humanizeRole(selected.actor_role)} />
                  <Field label="Actor ID" value={selected.actor_id || "System"} mono />
                  <Field label="Resource type" value={selected.resource_type || "—"} />
                  <Field label="Resource ID" value={selected.resource_id || "—"} mono />
                </div>
                <div>
                  <div className="label-caps mb-1.5 text-muted-foreground">Metadata</div>
                  {selected.metadata && Object.keys(selected.metadata).length > 0 ? (
                    <div className="space-y-1 rounded-sm border border-border bg-surface-2/40 p-3">
                      {Object.entries(selected.metadata).map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <span className="min-w-32 font-medium text-muted-foreground">{k}</span>
                          <span className="num break-all">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No additional metadata.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-sm border border-border bg-surface-2/40 p-2.5">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className={`mt-0.5 break-all font-medium ${mono ? "num" : ""}`}>{value}</div>
    </div>
  );
}
