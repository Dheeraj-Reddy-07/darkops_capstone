import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { logAudit, logSecurityEvent } from "../services/audit.service";
import { AppRole } from "../../src/types/auth";

const VALID_ROLES: AppRole[] = [
  "PLATFORM_ADMIN",
  "EXECUTIVE",
  "OPERATIONS",
  "STORE_MANAGER",
  "CUSTOMER_SUPPORT",
  "CUSTOMER",
];

/** Strip characters that would break a PostgREST `or()` filter expression. */
function sanitizeSearch(value: unknown): string {
  return String(value || "")
    .replace(/[,()*]/g, " ")
    .trim()
    .slice(0, 80);
}

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Service role + RBAC: the route is gated by requirePermission("admin.users").
    const supabase = createSupabaseServiceRoleClient();
    const query: any = req.query;

    let dbQuery = supabase.from("profiles").select("*").order("created_at", { ascending: false });

    if (query.role && query.role !== "all" && VALID_ROLES.includes(query.role)) {
      dbQuery = dbQuery.eq("role", query.role);
    }
    if (query.status === "active") dbQuery = dbQuery.eq("is_active", true);
    if (query.status === "inactive") dbQuery = dbQuery.eq("is_active", false);

    const search = sanitizeSearch(query.search);
    if (search) {
      dbQuery = dbQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await dbQuery;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const auth = (req as any).auth;
    const requestId = (req as any).requestId || "unknown";

    // Mass assignment protection: Only allow 'role' field
    const allowedFields = ["role"];
    const providedFields = Object.keys(req.body);
    const invalidFields = providedFields.filter((field) => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "PRIVILEGE_ESCALATION_ATTEMPT",
        resourceType: "user",
        resourceId: id,
        requestId,
        ip: req.ip,
        metadata: {
          reason: "mass_assignment_attempt",
          invalid_fields: invalidFields,
          allowed_fields: allowedFields,
        },
      });
      throw new HTTPError(400, "INVALID_FIELDS", `Only ${allowedFields.join(", ")} can be updated`);
    }

    if (!VALID_ROLES.includes(role)) {
      throw new HTTPError(400, "INVALID_ROLE", `Invalid role: ${role}`);
    }

    const adminClient = createSupabaseServiceRoleClient();

    const { data: user, error: fetchErr } = await adminClient
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", id)
      .single();

    if (fetchErr || !user) throw new HTTPError(404, "NOT_FOUND", "User not found");
    if (user.id === auth.user.id)
      throw new HTTPError(400, "INVALID_ACTION", "Cannot change your own role");
    if (user.role === role) {
      res.status(200).json({ success: true, message: "User already has this role" });
      return;
    }

    const { error: updateErr } = await adminClient.from("profiles").update({ role }).eq("id", id);

    if (updateErr) throw new HTTPError(500, "UPDATE_FAILED", "Failed to update user role");

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "USER_ROLE_CHANGED",
      resourceType: "profile",
      resourceId: id,
      requestId,
      metadata: { from_role: user.role, to_role: role, target_name: user.full_name },
    });

    res.status(200).json({ success: true, message: "User role updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const updateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const auth = (req as any).auth;
    const requestId = (req as any).requestId || "unknown";

    // Mass assignment protection: only 'is_active' is mutable here.
    const invalidFields = Object.keys(req.body).filter((f) => f !== "is_active");
    if (invalidFields.length > 0) {
      throw new HTTPError(400, "INVALID_FIELDS", "Only is_active can be updated");
    }
    if (typeof is_active !== "boolean") {
      throw new HTTPError(400, "INVALID_STATUS", "is_active must be a boolean");
    }

    const adminClient = createSupabaseServiceRoleClient();

    const { data: user, error: fetchErr } = await adminClient
      .from("profiles")
      .select("id, is_active, full_name, role")
      .eq("id", id)
      .single();

    if (fetchErr || !user) throw new HTTPError(404, "NOT_FOUND", "User not found");
    if (user.id === auth.user.id)
      throw new HTTPError(400, "INVALID_ACTION", "Cannot change your own account status");

    if (user.is_active === is_active) {
      res.status(200).json({ success: true, message: "Account status unchanged" });
      return;
    }

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({ is_active })
      .eq("id", id);

    if (updateErr) throw new HTTPError(500, "UPDATE_FAILED", "Failed to update account status");

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: is_active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      resourceType: "profile",
      resourceId: id,
      requestId,
      metadata: { target_name: user.full_name, target_role: user.role },
    });

    res.status(200).json({
      success: true,
      message: is_active ? "Account reactivated" : "Account deactivated",
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Service role + RBAC: the route is gated by requirePermission("audit.read").
    const supabase = createSupabaseServiceRoleClient();
    const query: any = req.query;

    let dbQuery = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("occurred_at", { ascending: false });

    if (query.action) dbQuery = dbQuery.eq("action", query.action);
    if (query.resource_type) dbQuery = dbQuery.eq("resource_type", query.resource_type);

    const limit = Math.min(parseInt(query.limit) || 100, 200);
    const page = Math.max(parseInt(query.page) || 1, 1);
    const from = (page - 1) * limit;
    dbQuery = dbQuery.range(from, from + limit - 1);

    const { data, error, count } = await dbQuery;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({
      data,
      meta: { total: count ?? data?.length ?? 0, page, limit },
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    // Service role + RBAC: the route is gated by requirePermission("audit.read").
    const supabase = createSupabaseServiceRoleClient();

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: userCount },
      { count: activeUserCount },
      { count: storeCount },
      { count: activeStoreCount },
      { count: recentAuditCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("stores").select("*", { count: "exact", head: true }),
      supabase.from("stores").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", since),
    ]);

    res.status(200).json({
      users: userCount || 0,
      active_users: activeUserCount || 0,
      stores: storeCount || 0,
      active_stores: activeStoreCount || 0,
      recent_audit_events: recentAuditCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Platform store directory for administrators. This is a governance/registry
 * view (identity, location, manager, operational status) — not the executive
 * analytics surface. Uses the service-role client; access is gated by RBAC on
 * the route (admin.system permission).
 */
export const getAdminStores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const query: any = req.query;

    let dbQuery = adminClient
      .from("stores")
      .select(
        "id, name, city, zone, manager_name, manager_profile_id, is_active, created_at, updated_at",
        { count: "exact" },
      )
      .order("name", { ascending: true });

    if (query.city && query.city !== "all") dbQuery = dbQuery.eq("city", query.city);
    if (query.status === "active") dbQuery = dbQuery.eq("is_active", true);
    if (query.status === "inactive") dbQuery = dbQuery.eq("is_active", false);

    const search = sanitizeSearch(query.search);
    if (search) {
      dbQuery = dbQuery.or(
        `name.ilike.%${search}%,id.ilike.%${search}%,city.ilike.%${search}%,manager_name.ilike.%${search}%`,
      );
    }

    const { data, error, count } = await dbQuery;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ data, meta: { total: count ?? data?.length ?? 0 } });
  } catch (error) {
    next(error);
  }
};

export const updateAdminStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const auth = (req as any).auth;
    const requestId = (req as any).requestId || "unknown";

    // Only operational status is administrable here.
    const invalidFields = Object.keys(req.body).filter((f) => f !== "is_active");
    if (invalidFields.length > 0) {
      throw new HTTPError(400, "INVALID_FIELDS", "Only is_active can be updated");
    }
    if (typeof is_active !== "boolean") {
      throw new HTTPError(400, "INVALID_STATUS", "is_active must be a boolean");
    }

    const adminClient = createSupabaseServiceRoleClient();

    const { data: store, error: fetchErr } = await adminClient
      .from("stores")
      .select("id, name, is_active")
      .eq("id", id)
      .single();

    if (fetchErr || !store) throw new HTTPError(404, "NOT_FOUND", "Store not found");

    if (store.is_active === is_active) {
      res.status(200).json({ success: true, message: "Store status unchanged" });
      return;
    }

    const { error: updateErr } = await adminClient
      .from("stores")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) throw new HTTPError(500, "UPDATE_FAILED", "Failed to update store");

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "STORE_UPDATED",
      resourceType: "store",
      resourceId: id,
      requestId,
      metadata: {
        store_name: store.name,
        field: "is_active",
        from: store.is_active,
        to: is_active,
      },
    });

    res.status(200).json({ success: true, message: "Store updated" });
  } catch (error) {
    next(error);
  }
};
