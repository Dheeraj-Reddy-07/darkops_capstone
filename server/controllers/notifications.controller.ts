import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;

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
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;

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
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;

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
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;

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
