import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { AuthContext } from "../../src/types/auth";
import { HTTPError } from "../middleware/errors";

// Audit event types for type safety
export type AuditAction =
  | "AUTH_LOGIN_SUCCESS"
  | "AUTH_LOGIN_FAILURE"
  | "AUTH_LOGOUT"
  | "AUTH_HANDOFF_ATTEMPT"
  | "ACCESS_DENIED"
  | "RATE_LIMIT_TRIGGERED"
  | "IDOR_ATTEMPT"
  | "PRIVILEGE_ESCALATION_ATTEMPT"
  | "SUSPICIOUS_QUERY_BLOCKED"
  | "CHATBOT_FEEDBACK_SUBMITTED"
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
  | "USER_ROLE_CHANGED"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "PROFILE_UPDATED"
  | "SETTINGS_UPDATED"
  | "STORE_UPDATED"
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
  | "resolution.auto_approved_refund"
  | "resolution.auto_approved_replacement"
  | "resolution.auto_approved_support_review"
  | "resolution.auto_approved_no_action"
  | "execution_handoff.created"
  | "execution_handoff.acknowledged"
  | "integration.resolution_acknowledged"
  | "complaint.route_to_store_manager"
  | "complaint.escalate_to_support"
  | "complaint.escalate_to_agent_queue";

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

    const isValidUUID = (id: string | undefined | null) =>
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        id || "",
      );

    const { error } = await adminClient.from("audit_logs").insert({
      actor_id: isValidUUID(params.actorId) ? params.actorId : null,
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

    const isValidUUID = (id: string | undefined | null) =>
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
        id || "",
      );

    const { error } = await adminClient.from("audit_logs").insert({
      actor_id: isValidUUID(params.actorId) ? params.actorId : null,
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
