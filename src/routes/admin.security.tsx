import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  AlertTriangle,
  Activity,
  Users,
  FileText,
  ChevronRight,
  Lock,
  Database,
  CheckCircle,
  Clock,
  AlertCircle,
  HelpCircle,
  Info,
} from "lucide-react";
import { Panel, PanelHeader, Chip, type Tone } from "@/components/ops/primitives";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { formatDateTime, formatShortDateTime } from "@/lib/utils";
import { humanizeAction, humanizeRole } from "@/lib/admin-format";

export const Route = createFileRoute("/admin/security")({
  head: () => ({
    meta: [
      { title: "Security Center - DarkOps Admin" },
      {
        name: "description",
        content: "Monitor DarkOps security controls, events, and threat indicators.",
      },
    ],
  }),
  component: SecurityCenter,
});

type ControlStatus = "PASS" | "PARTIAL" | "FAIL" | "UNKNOWN";

interface SecurityControl {
  id: string;
  name: string;
  category: string;
  description: string;
  verification_method: "runtime" | "configuration";
  status: ControlStatus;
  evidence: string[];
  last_verified: string;
}

const STATUS_META: Record<ControlStatus, { tone: Tone; icon: React.ReactNode; label: string }> = {
  PASS: { tone: "ok", icon: <CheckCircle className="size-4" />, label: "Passing" },
  PARTIAL: { tone: "warn", icon: <Clock className="size-4" />, label: "Partial" },
  FAIL: { tone: "crit", icon: <AlertCircle className="size-4" />, label: "Failing" },
  UNKNOWN: { tone: "neutral", icon: <HelpCircle className="size-4" />, label: "Unknown" },
};

function ControlCard({
  control,
  onOpen,
}: {
  control: SecurityControl;
  onOpen: (c: SecurityControl) => void;
}) {
  const meta = STATUS_META[control.status];
  const border =
    control.status === "PASS"
      ? "border-ok/30 bg-ok/5"
      : control.status === "PARTIAL"
        ? "border-warn/30 bg-warn/5"
        : control.status === "FAIL"
          ? "border-crit/30 bg-crit/5"
          : "border-border bg-surface-2/40";

  return (
    <button
      type="button"
      onClick={() => onOpen(control)}
      className={`rounded-sm border px-4 py-3 text-left transition-colors hover:border-primary/40 ${border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={
                control.status === "PASS"
                  ? "text-ok"
                  : control.status === "PARTIAL"
                    ? "text-warn"
                    : control.status === "FAIL"
                      ? "text-crit"
                      : "text-muted-foreground"
              }
            >
              {meta.icon}
            </span>
            <span className="text-sm font-medium">{control.name}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{control.description}</p>
        </div>
        <Chip tone={meta.tone}>{control.status}</Chip>
      </div>
    </button>
  );
}

function ControlDetailDialog({
  control,
  onClose,
}: {
  control: SecurityControl | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!control} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {control && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {control.name}
                <Chip tone={STATUS_META[control.status].tone}>{control.status}</Chip>
              </DialogTitle>
              <DialogDescription>{control.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-sm border border-border bg-surface-2/40 p-2.5">
                  <div className="label-caps text-muted-foreground">Verification</div>
                  <div className="mt-0.5 font-medium capitalize">{control.verification_method}</div>
                </div>
                <div className="rounded-sm border border-border bg-surface-2/40 p-2.5">
                  <div className="label-caps text-muted-foreground">Last verified</div>
                  <div className="num mt-0.5 font-medium">
                    {formatDateTime(control.last_verified)}
                  </div>
                </div>
              </div>
              <div>
                <div className="label-caps mb-1.5 text-muted-foreground">Evidence</div>
                <ul className="space-y-1.5">
                  {control.evidence.map((e, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-ok" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ArchitectureFlow() {
  const layers = [
    { name: "Internet", icon: null, tone: "muted" },
    { name: "HTTPS / Security Headers", icon: <Lock className="size-3" />, tone: "ok" },
    { name: "CORS allow-list", icon: <Shield className="size-3" />, tone: "ok" },
    { name: "Rate Limiting", icon: <Activity className="size-3" />, tone: "ok" },
    { name: "Authentication", icon: <Lock className="size-3" />, tone: "ok" },
    { name: "Authorization (RBAC)", icon: <Shield className="size-3" />, tone: "ok" },
    { name: "Role + Scope checks", icon: <Users className="size-3" />, tone: "ok" },
    { name: "Input Validation", icon: <CheckCircle className="size-3" />, tone: "ok" },
    { name: "PostgreSQL + RLS", icon: <Database className="size-3" />, tone: "ok" },
    { name: "Private Storage + Signed URLs", icon: <Lock className="size-3" />, tone: "ok" },
    { name: "Audit Logging", icon: <FileText className="size-3" />, tone: "ok" },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
      {layers.map((layer) => (
        <div
          key={layer.name}
          className={`flex items-center gap-2 rounded-sm border px-3 py-2.5 text-[13px] ${
            layer.tone === "ok" ? "border-ok/25 bg-ok/5" : "border-border bg-surface-2/40"
          }`}
        >
          {layer.icon}
          <span className="font-medium">{layer.name}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[13px] font-medium">{title}</span>
        </div>
        <div className="num mt-2 text-2xl font-semibold">{value.toLocaleString("en-IN")}</div>
      </div>
    </Panel>
  );
}

// Security-event counters cover a fixed 30-day window; there is no time-range
// control because event volume in this environment does not warrant one.
const METRICS_PERIOD = "30d";

function SecurityCenter() {
  const [selected, setSelected] = useState<SecurityControl | null>(null);

  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
  } = useQuery({
    queryKey: ["security-overview"],
    queryFn: async () => {
      const response = await fetchApi("/security/overview");
      return response.data as {
        controls: SecurityControl[];
        summary: {
          total: number;
          passing: number;
          partial: number;
          failing: number;
          unknown: number;
        };
        last_verified: string;
      };
    },
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery({
    queryKey: ["security-metrics", METRICS_PERIOD],
    queryFn: async () => {
      const response = await fetchApi(`/security/metrics?period=${METRICS_PERIOD}`);
      return response.data;
    },
  });

  const attention = overview
    ? overview.summary.partial + overview.summary.failing + overview.summary.unknown
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor DarkOps security controls, events, and threat indicators.
          </p>
        </div>
      </div>

      {/* Security Controls */}
      {overviewLoading ? (
        <Panel className="p-12 text-center text-sm text-muted-foreground">
          Verifying security controls…
        </Panel>
      ) : overviewError || !overview ? (
        <Panel className="p-8 text-center">
          <AlertTriangle className="mx-auto size-7 text-crit" />
          <p className="mt-3 text-sm font-medium">Unable to verify security controls</p>
          <p className="mt-1 text-xs text-muted-foreground">
            The verification service did not respond.
          </p>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader
            title="Security Controls"
            subtitle={
              attention > 0
                ? `${overview.summary.passing}/${overview.summary.total} passing · ${attention} need attention`
                : `${overview.summary.passing}/${overview.summary.total} passing`
            }
            right={
              <span className="text-xs text-muted-foreground">
                Verified {formatShortDateTime(overview.last_verified)}
              </span>
            }
          />
          <div className="p-4">
            <div className="mb-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-ok" /> Passing: {overview.summary.passing}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-warn" /> Partial:{" "}
                {overview.summary.partial}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-crit" /> Failing:{" "}
                {overview.summary.failing}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-muted-foreground/50" /> Unknown:{" "}
                {overview.summary.unknown}
              </span>
            </div>
            <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
              {overview.controls.map((control) => (
                <ControlCard key={control.id} control={control} onOpen={setSelected} />
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-sm border border-info/25 bg-info/5 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-info" />
              <span>
                <span className="font-medium text-foreground">
                  Control status and event count are different things.
                </span>{" "}
                A control being <span className="text-ok">passing</span> means the protection is
                configured and, where checkable, verified. The counters below show security events
                that have actually been recorded — zero events means no incidents, not a missing
                control.
              </span>
            </div>
          </div>
        </Panel>
      )}

      {/* Architecture */}
      <Panel>
        <PanelHeader
          title="Security Architecture"
          subtitle="Defense-in-depth: every layer maps to an implemented control."
        />
        <div className="p-4">
          <ArchitectureFlow />
        </div>
      </Panel>

      {/* Security events */}
      {metricsLoading ? (
        <Panel className="p-12 text-center text-sm text-muted-foreground">
          Loading security events…
        </Panel>
      ) : metricsError ? (
        <Panel className="p-8 text-center">
          <AlertTriangle className="mx-auto size-7 text-crit" />
          <p className="mt-3 text-sm font-medium">Unable to load security events</p>
          <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
        </Panel>
      ) : metrics ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Security events"
              value={metrics.metrics.total_security_events}
              icon={<Shield className="size-4" />}
            />
            <MetricCard
              title="Auth failures"
              value={metrics.metrics.auth_failures}
              icon={<Lock className="size-4" />}
            />
            <MetricCard
              title="Permission denied"
              value={metrics.metrics.permission_denied}
              icon={<Shield className="size-4" />}
            />
            <MetricCard
              title="IDOR attempts blocked"
              value={metrics.metrics.idor_attempts}
              icon={<AlertTriangle className="size-4" />}
            />
          </div>

          <Panel>
            <PanelHeader
              title="Threat Indicators"
              subtitle="Recorded over the last 30 days. Severity reflects recorded volume."
            />
            <div className="p-4">
              <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
                {metrics.threat_indicators.map((indicator: any) => (
                  <ThreatIndicatorCard
                    key={indicator.type}
                    type={indicator.type}
                    count={indicator.count}
                    severity={indicator.severity}
                  />
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Recent Security Events"
              subtitle="Authentication failures, denied access, and blocked attempts."
              right={
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/security/events">
                    View all
                    <ChevronRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              }
            />
            <div className="p-4">
              {metrics.recent_events.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No recent security events
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.recent_events.map((event: any) => (
                    <SecurityEventRow key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <div className="grid gap-3 md:grid-cols-3">
            <QuickActionCard
              title="Security Events"
              description="Filter recorded security events by type and role."
              icon={<Shield className="size-5" />}
              to="/admin/security/events"
            />
            <QuickActionCard
              title="Audit Logs"
              description="The full platform audit trail of state changes."
              icon={<FileText className="size-5" />}
              to="/admin/audit-logs"
            />
            <QuickActionCard
              title="User Activity"
              description="Activity and access patterns grouped by user."
              icon={<Users className="size-5" />}
              to="/admin/security/user-activity"
            />
          </div>
        </>
      ) : null}

      <ControlDetailDialog control={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ThreatIndicatorCard({
  type,
  count,
  severity,
}: {
  type: string;
  count: number;
  severity: string;
}) {
  const tone: Tone = severity === "high" ? "crit" : severity === "medium" ? "warn" : "ok";
  const border =
    tone === "crit"
      ? "border-crit/30 bg-crit/5"
      : tone === "warn"
        ? "border-warn/30 bg-warn/5"
        : "border-ok/25 bg-ok/5";
  return (
    <div className={`rounded-sm border px-4 py-3 ${border}`}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium">{type}</span>
        <span className="num text-lg font-semibold">{count}</span>
      </div>
      <div className="mt-1 text-xs capitalize text-muted-foreground">{severity} severity</div>
    </div>
  );
}

function SecurityEventRow({ event }: { event: any }) {
  const isCrit = event.action === "IDOR_ATTEMPT" || event.action === "PRIVILEGE_ESCALATION_ATTEMPT";
  return (
    <div className="flex items-center justify-between rounded-sm border border-border/70 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Chip tone={isCrit ? "crit" : "warn"}>{humanizeAction(event.action)}</Chip>
          {event.resource_type && (
            <span className="text-xs text-muted-foreground">· {event.resource_type}</span>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {humanizeRole(event.actor_role)}
          {event.actor_id ? ` · ${String(event.actor_id).slice(0, 8)}…` : ""}
        </div>
      </div>
      <div className="num ml-3 text-xs text-muted-foreground">
        {formatShortDateTime(event.occurred_at)}
      </div>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  to,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
}) {
  return (
    <Panel className="transition-colors hover:border-primary/50">
      <Button asChild variant="ghost" className="h-full w-full p-4">
        <Link to={to} className="flex items-start gap-3 text-left">
          <div className="rounded-sm bg-primary/10 p-2 text-primary">{icon}</div>
          <div className="flex-1">
            <div className="text-sm font-medium">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{description}</div>
          </div>
          <ChevronRight className="mt-1 size-4 text-muted-foreground" />
        </Link>
      </Button>
    </Panel>
  );
}
