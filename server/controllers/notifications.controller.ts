import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";

/** Returns true only for valid RFC-4122 UUIDs that Postgres will accept. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string | undefined | null): boolean {
  return !!id && UUID_RE.test(id);
}

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    // Mock/fallback user IDs (e.g. "usr-exec-001") are not valid UUIDs and
    // will cause a Postgres error. Return empty data safely instead.
    if (!isValidUUID(auth?.user?.id)) {
      return res.status(200).json({ data: [] });
    }

    const supabase = createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const auth = (req as any).auth;
    if (!isValidUUID(auth?.user?.id)) {
      return res.status(200).json({ success: true });
    }

    const supabase = createSupabaseServiceRoleClient();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("recipient_id", auth.user.id);

    if (error) throw new HTTPError(500, "UPDATE_FAILED", "Failed to mark notification as read");

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    if (!isValidUUID(auth?.user?.id)) {
      return res.status(200).json({ success: true });
    }

    const supabase = createSupabaseServiceRoleClient();

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", auth.user.id)
      .is("is_read", false);

    if (error)
      throw new HTTPError(500, "UPDATE_FAILED", "Failed to mark all notifications as read");

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    if (!isValidUUID(auth?.user?.id)) {
      return res.status(200).json({ count: 0 });
    }

    const supabase = createSupabaseServiceRoleClient();

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", auth.user.id)
      .is("is_read", false);

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ count: count || 0 });
  } catch (error) {
    next(error);
  }
};
