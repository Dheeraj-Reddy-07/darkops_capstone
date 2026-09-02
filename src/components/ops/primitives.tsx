import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, Lock, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Panel --------------------------------- */

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-md border border-border bg-surface shadow-[0_1px_0_0_rgba(255,255,255,0.02)_inset]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel className={cn(className)}>
      <PanelHeader title={title} subtitle={subtitle} right={right} />
      <div className="p-4">{children}</div>
    </Panel>
  );
}

/* --------------------------------- KPI card -------------------------------- */

export type Tone = "ok" | "warn" | "crit" | "info" | "neutral";

const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  crit: "text-crit",
  info: "text-info",
  neutral: "text-foreground",
};

export function KpiCard({
  label,
  value,
  unit,
  tone = "neutral",
  delta,
  deltaTone,
  footnote,
  emphasis,
  alert,
  children,
  className,
}: {
  label: string;
  value?: ReactNode;
  unit?: string;
  tone?: Tone;
  delta?: string;
  deltaTone?: "ok" | "crit" | "warn";
  footnote?: ReactNode;
  emphasis?: boolean;
  alert?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-surface px-4 py-3.5",
        alert ? "border-crit/45 bg-crit-soft/25" : "border-border",
        emphasis && !alert && "border-primary/40",
        className,
      )}
    >
      <div className="flex items-center gap-1.5">
        {alert ? <AlertTriangle className="size-3.5 text-crit" /> : null}
        <span className={cn("label-caps", alert && "text-crit")}>{label}</span>
      </div>
      {children ?? (
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className={cn("num text-[28px] leading-none font-semibold", toneText[tone])}>
            {value}
          </span>
          {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        </div>
      )}
      {(delta || footnote) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {delta ? (
            <span
              className={cn(
                "num inline-flex items-center gap-1 font-medium",
                deltaTone === "ok" ? "text-ok" : deltaTone === "warn" ? "text-warn" : "text-crit",
              )}
            >
              {deltaTone === "ok" ? (
                <TrendingDown className="size-3" />
              ) : (
                <TrendingUp className="size-3" />
              )}
              {delta}
            </span>
          ) : null}
          {footnote ? <span>{footnote}</span> : null}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Badges --------------------------------- */

const chipBase =
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-4";

export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  const map: Record<Tone, string> = {
    ok: "border-ok/35 bg-ok-soft/40 text-ok",
    warn: "border-warn/35 bg-warn-soft/40 text-warn",
    crit: "border-crit/40 bg-crit-soft/40 text-crit",
    info: "border-info/35 bg-info-soft/40 text-info",
    neutral: "border-border bg-surface-3 text-muted-foreground",
  };
  return <span className={cn(chipBase, map[tone], className)}>{children}</span>;
}

export function PriorityBadge({ priority }: { priority: "P1" | "P2" | "P3" | "P4" }) {
  const tone: Tone =
    priority === "P1" ? "crit" : priority === "P2" ? "warn" : priority === "P3" ? "info" : "neutral";
  return (
    <Chip tone={tone} className="num w-8 justify-center">
      {priority}
    </Chip>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone: Tone = s.includes("escalat")
    ? "crit"
    : s.includes("resolved") || s.includes("approved") || s.includes("healthy") || s.includes("settled")
      ? "ok"
      : s.includes("unassigned") || s.includes("pending") || s.includes("awaiting") || s.includes("risk")
        ? "warn"
        : s.includes("denied") || s.includes("critical") || s.includes("breach")
          ? "crit"
          : "info";
  return <Chip tone={tone}>{status}</Chip>;
}

export function SlaIndicator({ state, label }: { state: "on-track" | "at-risk" | "breached"; label?: string }) {
  const tone: Tone = state === "breached" ? "crit" : state === "at-risk" ? "warn" : "ok";
  const text = label ?? (state === "breached" ? "Breached" : state === "at-risk" ? "At risk" : "On track");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "size-1.5 rounded-full",
          tone === "crit" ? "bg-crit" : tone === "warn" ? "bg-warn" : "bg-ok",
        )}
      />
      <span className={cn("text-xs", toneText[tone])}>{text}</span>
    </span>
  );
}

export function LiveTag({ seconds = 13 }: { seconds?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-sm border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted-foreground">
      <span>
        Updated <span className="num text-foreground">{seconds}s</span> ago
      </span>
      <span className="flex items-center gap-1.5 text-ok">
        <span className="size-1.5 animate-pulse rounded-full bg-ok" />
        LIVE
      </span>
    </div>
  );
}

/* ---------------------------------- States -------------------------------- */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Inbox className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading operational data" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({
  title = "Could not load this view",
  hint,
  onRetry,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <AlertTriangle className="size-5 text-crit" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-md text-xs text-muted-foreground">{hint}</p> : null}
      {onRetry ? (
        <button
          onClick={onRetry}
          className="mt-2 rounded-sm border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface-3"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function PermissionDenied({ scope }: { scope: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <Lock className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">Restricted — {scope}</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Your role (Regional Ops) does not include this permission. Request access from the network
        operations administrator.
      </p>
    </div>
  );
}

/* --------------------------------- Tables --------------------------------- */

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "label-caps border-b border-border bg-surface-2/60 px-4 py-2.5 font-medium whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
}: {
  children?: ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "border-b border-border/70 px-4 py-2.5 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {children}
    </td>
  );
}
