import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Formatting utilities ─────────────────────────────────────────────────────

/** Format a number as Indian Rupees. Use { compact: true } for L/Cr shorthand. */
export function inr(value: number, opts: { compact?: boolean } = {}) {
  if (value === undefined || value === null) return "₹0";
  if (opts.compact) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Format a number with Indian locale grouping. */
export function num(value: number) {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString("en-IN");
}

/** Format a number as a percentage string. */
export function pct(value: number, digits = 1) {
  if (value === undefined || value === null) return "0%";
  return `${value.toFixed(digits)}%`;
}

/** Convert minutes to a human-readable duration string. */
export function minutesToDuration(mins: number) {
  if (mins === undefined || mins === null) return "0m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Format minutes elapsed as a compact "Xh YYm" label (for case age). */
export function ageLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Format minutes elapsed as a natural "Xh Ym ago" label. */
export function agoLabel(mins: number) {
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Date / time formatting ───────────────────────────────────────────────────
// One consistent, timezone-aware formatter for every admin surface. Any null,
// undefined, or unparseable value returns an intentional fallback so the UI
// never renders "Invalid Date".

const IST = "Asia/Kolkata";
const DATE_FALLBACK = "Not available";

function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Full date + time in IST (e.g. "15 Sep 2026, 14:30"). */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  fallback = DATE_FALLBACK,
): string {
  const d = toValidDate(value);
  if (!d) return fallback;
  return d.toLocaleString("en-IN", {
    timeZone: IST,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Date only in IST (e.g. "15 Sep 2026"). */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = DATE_FALLBACK,
): string {
  const d = toValidDate(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-IN", {
    timeZone: IST,
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Compact date + time for dense tables (e.g. "15 Sep, 14:30"). */
export function formatShortDateTime(
  value: string | number | Date | null | undefined,
  fallback = DATE_FALLBACK,
): string {
  const d = toValidDate(value);
  if (!d) return fallback;
  return d.toLocaleString("en-IN", {
    timeZone: IST,
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
