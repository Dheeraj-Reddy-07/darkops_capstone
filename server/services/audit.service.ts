import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { AuthContext } from "../../src/types/auth";
import { HTTPError } from "../middleware/errors";

// Audit event types for type safety
export type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_LOGOUT"
  | "ACCESS_DENIED"
  | "RATE_LIMIT_TRIGGERED"
  | "IDOR_ATTEMPT"
  | "PRIVILEGE_ESCALATION_ATTEMPT"
  | "COMPLAINT_CREATED"
  | "COMPLAINT_UPDATED"
  | "COMPLAINT_ESCALATED"
  | "COMPLAINT_RESOLVED"
  | "CASE_ASSIGNED"
  | "CASE_STATUS_CHANGED"
  | "ATTACHMENT_UPLOADED"
  | "ATTACHMENT_ACCESSED"
  | "FRAUD_REVIEW_CREATED"
  | "FRAUD_REVIEW_UPDATED"
  | "FRAUD_DECISION_MADE"
  | "ROLE_CHANGED"
  | "PERMISSION_DENIED"
  | "SECURITY_SETTING_CHANGED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_DELETED"
  | "case.assign"
  | "case.escalate"
  | "case.resolve"
  | "support.decide"
  | "support_ticket.status_change"
  | "support_ticket.resolve"
  | "support_ticket.create"
  | "failed_automation.resolve"
  | "refund.auto_approve"
  | "reorder.auto_approve"
  | "complaint.route_to_store_manager"
  | "complaint.escalate_to_support";

export async function logAudit(params: {
  actorId: string;
  actorRole: string;
  action: AuditAction;
  resourceType: string;
  resourceId: string | string[];
  metadata?: Record<string, any>;
  requestId?: string;
}) {
  try {
    const adminClient = createSupabaseServiceRoleClient();

    // Sanitize metadata to prevent logging sensitive information
    const sanitizedMetadata = sanitizeMetadata(params.metadata || {});

    // Handle resourceId as string or array
    const resourceIdValue = Array.isArray(params.resourceId)
      ? params.resourceId.join(",")
      : params.resourceId;

    const { error } = await adminClient.from("audit_logs").insert({
      actor_id: params.actorId,
      actor_role: params.actorRole,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: resourceIdValue,
      metadata: sanitizedMetadata,
      request_id: params.requestId,
    });

    if (error) {
      console.error("Failed to log audit event:", error);
    }
  } catch (error) {
    console.error("Audit logging error:", error);
  }
}

/**
 * Sanitize metadata to prevent logging sensitive information
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sensitiveKeys = ["password", "token", "secret", "key", "credit_card", "ssn", "api_key"];
  const sanitized = { ...metadata };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Log security events specifically
 */
export async function logSecurityEvent(params: {
  actorId?: string;
  actorRole?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | string[];
  metadata?: Record<string, any>;
  requestId?: string;
  ip?: string;
}) {
  try {
    const adminClient = createSupabaseServiceRoleClient();

    const sanitizedMetadata = sanitizeMetadata(params.metadata || {});

    // Handle resourceId as string or array
    const resourceIdValue = params.resourceId
      ? Array.isArray(params.resourceId)
        ? params.resourceId.join(",")
        : params.resourceId
      : "N/A";

    const { error } = await adminClient.from("audit_logs").insert({
      actor_id: params.actorId || "SYSTEM",
      actor_role: params.actorRole || "SYSTEM",
      action: params.action,
      resource_type: params.resourceType,
      resource_id: resourceIdValue,
      metadata: {
        ...sanitizedMetadata,
        ip: params.ip,
        is_security_event: true,
      },
      request_id: params.requestId,
    });

    if (error) {
      console.error("Failed to log security event:", error);
    }
  } catch (error) {
    console.error("Security event logging error:", error);
  }
}
