import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { logAudit, logSecurityEvent } from "../services/audit.service";
import { AppRole } from "../../src/types/auth";

// Mass assignment protection: Define allowed fields for each operation
const ALLOWED_USER_UPDATE_FIELDS = ["role", "is_active", "full_name", "hub_city", "store_id"];

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

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

    // Validate role value
    const validRoles: AppRole[] = [
      "PLATFORM_ADMIN",
      "EXECUTIVE",
      "OPERATIONS",
      "FRAUD_ANALYST",
      "STORE_MANAGER",
      "CUSTOMER_SUPPORT",
      "CUSTOMER",
    ];
    if (!validRoles.includes(role)) {
      throw new HTTPError(400, "INVALID_ROLE", `Invalid role: ${role}`);
    }

    const adminClient = createSupabaseServiceRoleClient();

    const { data: user, error: fetchErr } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", id)
      .single();

    if (fetchErr || !user) throw new HTTPError(404, "NOT_FOUND", "User not found");
    if (user.id === auth.user.id)
      throw new HTTPError(400, "INVALID_ACTION", "Cannot change your own role");

    const { error: updateErr } = await adminClient.from("profiles").update({ role }).eq("id", id);

    if (updateErr) throw new HTTPError(500, "UPDATE_FAILED", "Failed to update user role");

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "ROLE_CHANGED",
      resourceType: "profile",
      resourceId: id,
      requestId,
      metadata: { from_role: user.role, to_role: role },
    });

    res.status(200).json({ success: true, message: "User role updated successfully" });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const query: any = req.query;

    let dbQuery = supabase
      .from("audit_logs")
      .select("*")
      .order("occurred_at", { ascending: false });

    if (query.action) dbQuery = dbQuery.eq("action", query.action);
    if (query.resource_type) dbQuery = dbQuery.eq("resource_type", query.resource_type);
    if (query.limit) dbQuery = dbQuery.limit(parseInt(query.limit));

    const { data, error } = await dbQuery;

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const getSystemStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);

    const [
      { count: userCount },
      { count: storeCount },
      { count: complaintCount },
      { count: fraudCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("stores").select("*", { count: "exact", head: true }),
      supabase.from("complaints").select("*", { count: "exact", head: true }),
      supabase.from("fraud_reviews").select("*", { count: "exact", head: true }),
    ]);

    res.status(200).json({
      users: userCount || 0,
      stores: storeCount || 0,
      complaints: complaintCount || 0,
      fraud_reviews: fraudCount || 0,
    });
  } catch (error) {
    next(error);
  }
};
