import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { sanitizeString } from "../lib/validation";
import { logAudit } from "../services/audit.service";

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.auth is populated by the requireAuth middleware
    res.status(200).json({
      user: req.auth!.user,
      permissions: Array.from(req.auth!.permissions),
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferences, full_name, hub_city, location } = req.body;
    const auth = (req as any).auth;
    const adminClient = createSupabaseServiceRoleClient();

    const updates: Record<string, any> = {};

    if (preferences !== undefined && typeof preferences === "object" && preferences !== null) {
      updates.preferences = preferences;
    }

    if (full_name !== undefined && typeof full_name === "string") {
      updates.full_name = sanitizeString(full_name);
    }

    const cityInput = hub_city !== undefined ? hub_city : location;
    if (cityInput !== undefined && typeof cityInput === "string") {
      updates.hub_city = sanitizeString(cityInput);
    }

    if (Object.keys(updates).length === 0) {
      throw new HTTPError(
        400,
        "BAD_REQUEST",
        "No valid editable profile fields or preferences provided",
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", auth.user.id)
      .select()
      .single();

    if (error) {
      throw new HTTPError(500, "DATABASE_ERROR", `Failed to update preferences: ${error.message}`);
    }

    // Audit trail: distinguish identity edits from preference changes.
    const requestId = (req as any).requestId || "unknown";
    const changedIdentity = "full_name" in updates || "hub_city" in updates;
    const changedPreferences = "preferences" in updates;
    if (changedIdentity) {
      await logAudit({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "PROFILE_UPDATED",
        resourceType: "profile",
        resourceId: auth.user.id,
        requestId,
        metadata: { fields: Object.keys(updates).filter((k) => k !== "preferences") },
      });
    }
    if (changedPreferences) {
      await logAudit({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "SETTINGS_UPDATED",
        resourceType: "profile",
        resourceId: auth.user.id,
        requestId,
        metadata: { scope: "preferences" },
      });
    }

    res.status(200).json({ user: data });
  } catch (error) {
    next(error);
  }
};

import { verifyHandoffToken } from "../services/handoff.service";

export const verifyHandoff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const handoffToken = req.body.handoff_token || req.body.token || req.query.handoff;

    if (!handoffToken || typeof handoffToken !== "string") {
      res.status(400).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Please sign in to continue",
        },
      });
      return;
    }

    const result = await verifyHandoffToken(handoffToken, {
      ip: req.ip,
      requestId: req.requestId,
    });

    if (!result.success) {
      // Fail closed: Generic non-revealing error message to prevent probing oracle
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Please sign in to continue",
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      sessionToken: result.sessionToken,
      userProfile: result.userProfile,
      order_id: result.order_id,
      issue_category: result.issue_category,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Please sign in to continue",
      },
    });
  }
};
