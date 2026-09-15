import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { verifySecurityPosture } from "../services/security-posture.service";

/**
 * The audit_logs table timestamps rows with `occurred_at` (see migration 011).
 * All security reads normalise to this column and expose it back to the client
 * as `occurred_at`.
 */
const OCCURRED_AT = "occurred_at";

/**
 * Get security metrics for the dashboard
 */
export const getSecurityMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const { period } = req.query;
    const requestId = (req as any).requestId || "unknown";

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Fetch security events
    const { data: securityEvents, error: eventsError } = await adminClient
      .from("audit_logs")
      .select("*")
      .gte(OCCURRED_AT, startDate.toISOString())
      .eq("metadata->>is_security_event", "true");

    if (eventsError) throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch security events");

    // Calculate metrics
    const totalSecurityEvents = securityEvents?.length || 0;
    const idorAttempts =
      securityEvents?.filter((e: any) => e.action === "IDOR_ATTEMPT").length || 0;
    const authFailures =
      securityEvents?.filter((e: any) => e.action === "AUTH_LOGIN_FAILURE").length || 0;
    const permissionDenied =
      securityEvents?.filter((e: any) => e.action === "PERMISSION_DENIED").length || 0;
    const privilegeEscalation =
      securityEvents?.filter((e: any) => e.action === "PRIVILEGE_ESCALATION_ATTEMPT").length || 0;

    // Get unique users with security events
    const uniqueUsers = new Set(securityEvents?.map((e: any) => e.actor_id) || []);
    const affectedUsers = uniqueUsers.size;

    // Get recent security events (last 10)
    const recentEvents =
      securityEvents
        ?.sort(
          (a: any, b: any) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
        )
        .slice(0, 10)
        .map((event: any) => ({
          id: event.id,
          action: event.action,
          actor_id: event.actor_id,
          actor_role: event.actor_role,
          resource_type: event.resource_type,
          resource_id: event.resource_id,
          occurred_at: event.occurred_at,
          metadata: event.metadata,
        })) || [];

    // Get top threat indicators
    const threatIndicators = [
      {
        type: "IDOR Attempts",
        count: idorAttempts,
        severity: idorAttempts > 10 ? "high" : idorAttempts > 5 ? "medium" : "low",
      },
      {
        type: "Auth Failures",
        count: authFailures,
        severity: authFailures > 50 ? "high" : authFailures > 20 ? "medium" : "low",
      },
      {
        type: "Permission Denied",
        count: permissionDenied,
        severity: permissionDenied > 30 ? "high" : permissionDenied > 15 ? "medium" : "low",
      },
      {
        type: "Privilege Escalation",
        count: privilegeEscalation,
        severity: privilegeEscalation > 0 ? "high" : "low",
      },
    ];

    res.status(200).json({
      data: {
        period,
        start_date: startDate.toISOString(),
        end_date: now.toISOString(),
        metrics: {
          total_security_events: totalSecurityEvents,
          idor_attempts: idorAttempts,
          auth_failures: authFailures,
          permission_denied: permissionDenied,
          privilege_escalation: privilegeEscalation,
          affected_users: affectedUsers,
        },
        recent_events: recentEvents,
        threat_indicators: threatIndicators,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get security events with filtering
 */
export const getSecurityEvents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const { action, actor_id, actor_role, resource_type, start_date, end_date, page, limit } =
      req.query;
    const requestId = (req as any).requestId || "unknown";

    let query = adminClient
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("metadata->>is_security_event", "true");

    // Apply filters
    if (action) query = query.eq("action", action);
    if (actor_id) query = query.eq("actor_id", actor_id);
    if (actor_role) query = query.eq("actor_role", actor_role);
    if (resource_type) query = query.eq("resource_type", resource_type);
    if (start_date) query = query.gte(OCCURRED_AT, start_date);
    if (end_date) query = query.lte(OCCURRED_AT, end_date);

    // Apply pagination
    const validatedLimit = parseInt(limit as string) || 50;
    const validatedPage = parseInt(page as string) || 1;
    const from = (validatedPage - 1) * validatedLimit;
    const to = from + validatedLimit - 1;

    query = query.range(from, to).order(OCCURRED_AT, { ascending: false });

    const { data: events, error, count } = await query;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch security events");

    res.status(200).json({
      data: events,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: count || 0,
        pages: Math.ceil((count || 0) / validatedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get audit logs with filtering
 */
export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const { action, actor_id, actor_role, resource_type, start_date, end_date, page, limit } =
      req.query;
    const requestId = (req as any).requestId || "unknown";

    let query = adminClient.from("audit_logs").select("*", { count: "exact" });

    // Apply filters
    if (action) query = query.eq("action", action);
    if (actor_id) query = query.eq("actor_id", actor_id);
    if (actor_role) query = query.eq("actor_role", actor_role);
    if (resource_type) query = query.eq("resource_type", resource_type);
    if (start_date) query = query.gte(OCCURRED_AT, start_date);
    if (end_date) query = query.lte(OCCURRED_AT, end_date);

    // Apply pagination
    const validatedLimit = parseInt(limit as string) || 50;
    const validatedPage = parseInt(page as string) || 1;
    const from = (validatedPage - 1) * validatedLimit;
    const to = from + validatedLimit - 1;

    query = query.range(from, to).order(OCCURRED_AT, { ascending: false });

    const { data: logs, error, count } = await query;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch audit logs");

    res.status(200).json({
      data: logs,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: count || 0,
        pages: Math.ceil((count || 0) / validatedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user activity
 */
export const getUserActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const { user_id, role, start_date, end_date, page, limit } = req.query;
    const requestId = (req as any).requestId || "unknown";

    let query = adminClient.from("audit_logs").select("*", { count: "exact" });

    // Apply filters
    if (user_id) query = query.eq("actor_id", user_id);
    if (role) query = query.eq("actor_role", role);
    if (start_date) query = query.gte(OCCURRED_AT, start_date);
    if (end_date) query = query.lte(OCCURRED_AT, end_date);

    // Apply pagination
    const validatedLimit = parseInt(limit as string) || 50;
    const validatedPage = parseInt(page as string) || 1;
    const from = (validatedPage - 1) * validatedLimit;
    const to = from + validatedLimit - 1;

    query = query.range(from, to).order(OCCURRED_AT, { ascending: false });

    const { data: activities, error, count } = await query;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch user activity");

    // Group by user for summary
    const userSummary = activities?.reduce((acc: any, activity: any) => {
      const userId = activity.actor_id;
      if (!acc[userId]) {
        acc[userId] = {
          user_id: userId,
          role: activity.actor_role,
          action_count: 0,
          last_activity: activity.occurred_at,
        };
      }
      acc[userId].action_count += 1;
      return acc;
    }, {});

    res.status(200).json({
      data: activities,
      summary: Object.values(userSummary || {}),
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        total: count || 0,
        pages: Math.ceil((count || 0) / validatedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get security overview with control statuses
 */
export const getSecurityOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posture = await verifySecurityPosture();
    res.status(200).json({ data: posture });
  } catch (error) {
    next(error);
  }
};
