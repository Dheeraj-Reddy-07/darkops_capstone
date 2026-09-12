import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  AlertTriangle,
  Activity,
  Users,
  FileText,
  TrendingUp,
  ChevronRight,
  Lock,
  Database,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowDown,
} from "lucide-react";
import { Panel, PanelHeader, Chip, StatusBadge } from "@/components/ops/primitives";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/security")({
  head: () => ({
    meta: [
      { title: "Security Center - DarkOps Admin" },
      {
        name: "description",
        content: "Monitor security events, audit logs, and system security metrics.",
      },
    ],
  }),
  component: SecurityCenter,
});

function ControlCard({ control }: { control: any }) {
  const statusColors = {
    PASS: "bg-ok/10 text-ok border-ok/30",
    PARTIAL: "bg-warn/10 text-warn border-warn/30",
    FAIL: "bg-crit/10 text-crit border-crit/30",
  };

  const statusIcons = {
    PASS: <CheckCircle className="size-4" />,
    PARTIAL: <Clock className="size-4" />,
    FAIL: <AlertCircle className="size-4" />,
  };

  return (
    <div
      className={`rounded-sm border px-4 py-3 ${statusColors[control.status as keyof typeof statusColors]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {statusIcons[control.status as keyof typeof statusIcons]}
            <span className="text-sm font-medium">{control.name}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{control.description}</p>
        </div>
        <Chip
          tone={control.status === "PASS" ? "ok" : control.status === "PARTIAL" ? "warn" : "crit"}
        >
          {control.status}
        </Chip>
      </div>
    </div>
  );
}

function ArchitectureFlow() {
  const layers = [
    { name: "Internet", icon: null, color: "bg-muted" },
    { name: "HTTPS / Security Headers", icon: <Lock className="size-3" />, color: "bg-primary/10" },
    { name: "CORS", icon: <Shield className="size-3" />, color: "bg-primary/10" },
    { name: "Rate Limiting", icon: <Activity className="size-3" />, color: "bg-warn/10" },
    { name: "Authentication", icon: <Lock className="size-3" />, color: "bg-ok/10" },
    { name: "Authorization", icon: <Shield className="size-3" />, color: "bg-ok/10" },
    { name: "Role + Scope", icon: <Users className="size-3" />, color: "bg-ok/10" },
    { name: "Zod Validation", icon: <CheckCircle className="size-3" />, color: "bg-ok/10" },
    { name: "Business Logic", icon: null, color: "bg-muted" },
    { name: "PostgreSQL + RLS", icon: <Database className="size-3" />, color: "bg-ok/10" },
    { name: "Private Storage", icon: <Lock className="size-3" />, color: "bg-warn/10" },
    { name: "Audit Logging", icon: <FileText className="size-3" />, color: "bg-ok/10" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {layers.map((layer, index) => (
        <div
          key={layer.name}
          className={`flex items-center gap-2 rounded-sm border px-4 py-3 text-sm ${layer.color}`}
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
  trend,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend: "up" | "down" | "neutral" | null;
}) {
  const trendColor =
    trend === "up" ? "text-crit" : trend === "down" ? "text-ok" : "text-muted-foreground";

  return (
    <Panel>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {trend && (
            <TrendingUp className={`size-4 ${trend === "up" ? "rotate-180" : ""} ${trendColor}`} />
          )}
        </div>
        <div className="mt-2 text-2xl font-semibold">{value.toLocaleString()}</div>
      </div>
    </Panel>
  );
}

function SecurityCenter() {
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["security-overview"],
    queryFn: async () => {
      const response = await fetchApi("/security/overview");
      return response.data;
    },
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
  } = useQuery({
    queryKey: ["security-metrics", period],
    queryFn: async () => {
      const response = await fetchApi(`/security/metrics?period=${period}`);
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor security controls, events, and threat indicators
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={period === "24h" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("24h")}
          >
            24h
          </Button>
          <Button
            variant={period === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("7d")}
          >
            7d
          </Button>
          <Button
            variant={period === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("30d")}
          >
            30d
          </Button>
        </div>
      </div>

      {/* Security Overview */}
      {overviewLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-sm text-muted-foreground">Loading security overview...</div>
        </div>
      ) : overview ? (
        <>
          <Panel>
            <PanelHeader
              title="Security Controls"
              subtitle={`${overview.summary.passing}/${overview.summary.total} controls passing`}
            />
            <div className="p-4">
              <div className="mb-4 flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-ok" />
                  <span className="text-muted-foreground">Passing: {overview.summary.passing}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-warn" />
                  <span className="text-muted-foreground">Partial: {overview.summary.partial}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-crit" />
                  <span className="text-muted-foreground">Failing: {overview.summary.failing}</span>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {overview.controls.map((control: any) => (
                  <ControlCard key={control.name} control={control} />
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Last verified: {format(new Date(overview.last_verified), "dd MMM yyyy, HH:mm")}
              </div>
            </div>
          </Panel>

          {/* Security Architecture */}
          <Panel>
            <PanelHeader
              title="Security Architecture"
              subtitle="Defense-in-depth security layers"
            />
            <div className="p-4">
              <ArchitectureFlow />
            </div>
          </Panel>
        </>
      ) : null}

      {/* Security Metrics */}
      {metricsLoading ? (
        <div className="flex items-center justify-center p-12">
          <div className="text-sm text-muted-foreground">Loading security metrics...</div>
        </div>
      ) : metricsError ? (
        <Panel className="p-8 text-center">
          <AlertTriangle className="mx-auto size-8 text-crit" />
          <h1 className="mt-3 text-lg font-semibold">Unable to load security data</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please check your connection and try again.
          </p>
        </Panel>
      ) : metrics ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Security Events"
              value={metrics.metrics.total_security_events}
              icon={<Shield className="size-4" />}
              trend={null}
            />
            <MetricCard
              title="IDOR Attempts"
              value={metrics.metrics.idor_attempts}
              icon={<AlertTriangle className="size-4" />}
              trend={
                metrics.metrics.idor_attempts > 10
                  ? "up"
                  : metrics.metrics.idor_attempts > 5
                    ? "neutral"
                    : "down"
              }
            />
            <MetricCard
              title="Auth Failures"
              value={metrics.metrics.auth_failures}
              icon={<Activity className="size-4" />}
              trend={
                metrics.metrics.auth_failures > 50
                  ? "up"
                  : metrics.metrics.auth_failures > 20
                    ? "neutral"
                    : "down"
              }
            />
            <MetricCard
              title="Affected Users"
              value={metrics.metrics.affected_users}
              icon={<Users className="size-4" />}
              trend={null}
            />
          </div>

          {/* Threat Indicators */}
          <Panel>
            <PanelHeader title="Threat Indicators" subtitle="Current security threat levels" />
            <div className="p-4">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
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

          {/* Recent Security Events */}
          <Panel>
            <PanelHeader
              title="Recent Security Events"
              subtitle="Latest security-related activities"
              right={
                <Button asChild variant="outline" size="sm">
                  <Link to="/admin/security/events">
                    View All
                    <ChevronRight className="ml-2 size-4" />
                  </Link>
                </Button>
              }
            />
            <div className="p-4">
              <div className="space-y-2">
                {metrics.recent_events.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No recent security events
                  </div>
                ) : (
                  metrics.recent_events.map((event: any) => (
                    <SecurityEventRow key={event.id} event={event} />
                  ))
                )}
              </div>
            </div>
          </Panel>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <QuickActionCard
              title="Security Events"
              description="View all security events and filter by type"
              icon={<Shield className="size-5" />}
              to="/admin/security/events"
            />
            <QuickActionCard
              title="Audit Logs"
              description="View complete audit trail of system activities"
              icon={<FileText className="size-5" />}
              to="/admin/audit-logs"
            />
            <QuickActionCard
              title="User Activity"
              description="Monitor user activities and access patterns"
              icon={<Users className="size-5" />}
              to="/admin/security/user-activity"
            />
          </div>
        </>
      ) : null}
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
  const severityColors = {
    high: "bg-crit/10 text-crit border-crit/30",
    medium: "bg-warn/10 text-warn border-warn/30",
    low: "bg-ok/10 text-ok border-ok/30",
  };

  return (
    <div
      className={`rounded-sm border px-4 py-3 ${severityColors[severity as keyof typeof severityColors]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{type}</span>
        <span className="text-lg font-semibold">{count}</span>
      </div>
      <div className="mt-1 text-xs capitalize opacity-80">{severity} severity</div>
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

  return (
    <div className="flex items-center justify-between rounded-sm border border-border/70 px-4 py-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${actionColors[event.action] || "text-foreground"}`}>
            {event.action.replace(/_/g, " ")}
          </span>
          {event.resource_type && (
            <span className="text-muted-foreground">· {event.resource_type}</span>
          )}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {event.actor_role} · {event.actor_id?.slice(0, 8)}...
        </div>
      </div>
      <div className="ml-3 text-xs text-muted-foreground">
        {format(new Date(event.created_at), "dd MMM, HH:mm")}
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
    <Panel className="hover:border-primary/50 transition-colors">
      <Button asChild variant="ghost" className="h-full w-full p-4">
        <Link to={to} className="flex items-start gap-3 text-left">
          <div className="rounded-sm bg-primary/10 p-2 text-primary">{icon}</div>
          <div className="flex-1">
            <div className="font-medium">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{description}</div>
          </div>
          <ChevronRight className="size-4 text-muted-foreground mt-1" />
        </Link>
      </Button>
    </Panel>
  );
}
