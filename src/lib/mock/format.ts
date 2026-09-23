export function inr(value: number, opts: { compact?: boolean } = {}) {
  if (value === undefined || value === null) return "₹0";
  if (opts.compact) {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  }
  return `₹${value.toLocaleString("en-IN")}`;
}

export function num(value: number) {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString("en-IN");
}

export function pct(value: number, digits = 1) {
  if (value === undefined || value === null) return "0%";
  return `${value.toFixed(digits)}%`;
}

export function minutesToDuration(mins: number) {
  if (mins === undefined || mins === null) return "0m";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function ageLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** Fixed reference "now" so the prototype never drifts. IST. */
export const NOW_IST = "2026-08-29 21:40 IST";

export function istClock(offsetMinutes: number) {
  const base = 21 * 60 + 40 - offsetMinutes;
  const wrapped = ((base % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function agoLabel(mins: number) {
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}
