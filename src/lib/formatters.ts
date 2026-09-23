/**
 * Shared Human-Readable Label Formatting Utility
 * Standardizes enums, snake_case strings, and resolution codes across
 * Support, Operations, and Customer UI components.
 */

const CATEGORY_MAP: Record<string, string> = {
  quality_issue: "Quality Issue",
  missing_item: "Missing Item",
  damaged_item: "Damaged Item",
  late_delivery: "Late Delivery",
  wrong_item: "Wrong Item",
  payment_issue: "Payment Issue",
  other: "Other Issue",
  "Quality issue": "Quality Issue",
  "Late delivery": "Late Delivery",
  "Missing item": "Missing Item",
  "Wrong item": "Wrong Item",
  "Damaged item": "Damaged Item",
  "Payment issue": "Payment Issue",
};

const STATUS_MAP: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  awaiting_customer: "Awaiting Customer",
  escalated: "Escalated",
  escalated_l2: "Escalated (L2)",
  resolved: "Resolved",
  closed: "Closed",
  unassigned: "Unassigned",
  Assigned: "Assigned",
  "In progress": "In Progress",
  "Awaiting customer": "Awaiting Customer",
  "Escalated - L2": "Escalated (L2)",
  Resolved: "Resolved",
};

const QUEUE_MAP: Record<string, string> = {
  refunds: "Refunds",
  general: "General",
  delivery: "Delivery",
  operational: "Operational",
  escalated: "Escalated",
  reorders: "Reorders",
};

const RESOLUTION_DECISION_MAP: Record<string, string> = {
  REFUND: "Refund Approved",
  REPLACEMENT: "Replacement Approved",
  SUPPORT_REVIEW: "Support Review",
  PENDING_AGENT_REVIEW: "Pending Agent Review",
  NO_ACTION: "No Action / Rejected",
  Refund: "Refund Approved",
  Replacement: "Replacement Approved",
};

const PRIORITY_MAP: Record<string, string> = {
  P1: "P1 · Critical",
  P2: "P2 · High",
  P3: "P3 · Medium",
  P4: "P4 · Low",
};

/** Convert unknown snake_case string to Title Case */
function snakeToTitleCase(str: string): string {
  if (!str) return "N/A";
  return str
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Format issue category */
export function formatCategory(category?: string | null): string {
  if (!category) return "N/A";
  return CATEGORY_MAP[category] || snakeToTitleCase(category);
}

/** Format ticket/case status */
export function formatStatus(status?: string | null): string {
  if (!status) return "N/A";
  return STATUS_MAP[status] || snakeToTitleCase(status);
}

/** Format ticket queue name */
export function formatQueue(queue?: string | null): string {
  if (!queue) return "N/A";
  return QUEUE_MAP[queue] || snakeToTitleCase(queue);
}

/** Format resolution decision code */
export function formatResolution(decision?: string | null): string {
  if (!decision) return "Pending Agent Review";
  return RESOLUTION_DECISION_MAP[decision] || snakeToTitleCase(decision);
}

/** Format priority code */
export function formatPriority(priority?: string | null): string {
  if (!priority) return "P3 · Medium";
  return PRIORITY_MAP[priority] || priority;
}
