import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";
import { sanitizeString } from "../lib/validation";

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
      throw new HTTPError(400, "BAD_REQUEST", "No valid editable profile fields or preferences provided");
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

    res.status(200).json({ user: data });
  } catch (error) {
    next(error);
  }
};

