import { cn } from "@/lib/utils";

export interface TimelineEvent {
  label: string;
  at: string;
  detail?: string;
  state?: "done" | "current" | "pending";
  tone?: "ok" | "warn" | "crit" | "info";
  actor?: string;
  action?: string;
  time?: string;
}

const toneRing: Record<string, string> = {
  ok: "border-ok text-ok",
  warn: "border-warn text-warn",
  crit: "border-crit text-crit",
  info: "border-info text-info",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="relative">
      {events.map((e, i) => {
        const last = i === events.length - 1;
        const tone = e.state === "pending" ? undefined : e.tone;
        return (
          <li key={`${e.label}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span className="absolute top-4 bottom-0 left-[7px] w-px bg-border" aria-hidden />
            )}
            <span
              className={cn(
                "relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 bg-surface",
                e.state === "pending"
                  ? "border-border"
                  : e.state === "current"
                    ? "border-primary"
                    : (tone && toneRing[tone]) || "border-muted-foreground",
                e.state === "current" && "ring-primary/25 ring-4",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p
                  className={cn(
                    "text-[13px] font-medium",
                    e.state === "pending" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {e.label}
                </p>
                <span className="num text-xs text-muted-foreground">{e.at}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{e.detail}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
