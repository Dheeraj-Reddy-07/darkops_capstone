import type { Tone } from "@/components/ops/primitives";

/**
 * Human-readable labels + status tones for audit / security actions.
 *
 * The audit vocabulary mixes SCREAMING_SNAKE_CASE (USER_ROLE_CHANGED) and
 * dotted workflow verbs (case.assign, resolution.auto_approved_refund). This
 * renders either into a clean label without inventing meaning.
 */

const KNOWN_LABELS: Record<string, string> = {
  USER_ROLE_CHANGED: "User role changed",
  ROLE_CHANGED: "User role changed",
  USER_DEACTIVATED: "User deactivated",
  USER_REACTIVATED: "User reactivated",
  PROFILE_UPDATED: "Profile updated",
  SETTINGS_UPDATED: "Settings updated",
  STORE_UPDATED: "Store updated",
  COMPLAINT_CREATED: "Complaint created",
  COMPLAINT_UPDATED: "Complaint updated",
  COMPLAINT_ESCALATED: "Complaint escalated",
  COMPLAINT_RESOLVED: "Complaint resolved",
  CASE_ASSIGNED: "Case assigned",
  CASE_STATUS_CHANGED: "Case status changed",
  ATTACHMENT_UPLOADED: "Attachment uploaded",
  ATTACHMENT_ACCESSED: "Attachment accessed",
  AUTH_LOGIN_SUCCESS: "Sign-in succeeded",
  AUTH_LOGIN_FAILURE: "Sign-in failed",
  AUTH_LOGOUT: "Sign-out",
  PERMISSION_DENIED: "Permission denied",
  ACCESS_DENIED: "Access denied",
  IDOR_ATTEMPT: "IDOR attempt blocked",
  PRIVILEGE_ESCALATION_ATTEMPT: "Privilege escalation blocked",
  RATE_LIMIT_TRIGGERED: "Rate limit triggered",
  SUSPICIOUS_QUERY_BLOCKED: "Suspicious query blocked",
};

export function humanizeAction(action: string | null | undefined): string {
  if (!action) return "—";
  if (KNOWN_LABELS[action]) return KNOWN_LABELS[action];
  const spaced = action.replace(/[._]/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

const CRIT = ["denied", "idor", "escalation", "deactivat", "failure", "suspicious", "blocked"];
const WARN = ["escalat", "rate_limit", "at_risk", "attempt"];
const OK = ["reactivat", "success", "resolved", "approved", "created", "acknowledged"];

export function actionTone(action: string | null | undefined): Tone {
  const a = String(action || "").toLowerCase();
  if (CRIT.some((k) => a.includes(k))) return "crit";
  if (WARN.some((k) => a.includes(k))) return "warn";
  if (OK.some((k) => a.includes(k))) return "ok";
  return "neutral";
}

export function humanizeRole(role: string | null | undefined): string {
  if (!role) return "—";
  return role.replace(/_/g, " ");
}
