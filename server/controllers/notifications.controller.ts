import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { HTTPError } from "../middleware/errors";

export const getNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    if (!auth?.user?.id) {
      return res.status(200).json({ data: [] });
    }

    const { data, error } = await adminClient
      .from("notifications")
      .select("*")
      .eq("recipient_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    if (!auth?.user?.id) {
      throw new HTTPError(401, "UNAUTHORIZED", "User context missing");
    }

    const { error } = await adminClient
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
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    if (!auth?.user?.id) {
      throw new HTTPError(401, "UNAUTHORIZED", "User context missing");
    }

    const { error } = await adminClient
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", auth.user.id)
      .eq("is_read", false);

    if (error)
      throw new HTTPError(500, "UPDATE_FAILED", "Failed to mark all notifications as read");

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    if (!auth?.user?.id) {
      return res.status(200).json({ count: 0 });
    }

    const { count, error } = await adminClient
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", auth.user.id)
      .eq("is_read", false);

    if (error) throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);

    res.status(200).json({ count: count || 0 });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    if (!auth?.user?.id) {
      throw new HTTPError(401, "UNAUTHORIZED", "User context missing");
    }

    const { error } = await adminClient
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("recipient_id", auth.user.id);

    if (error) throw new HTTPError(500, "DELETE_FAILED", `Failed to delete notification: ${error.message}`);

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    next(error);
  }
};

export const clearAllNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    if (!auth?.user?.id) {
      throw new HTTPError(401, "UNAUTHORIZED", "User context missing");
    }

    const { error } = await adminClient
      .from("notifications")
      .delete()
      .eq("recipient_id", auth.user.id);

    if (error) throw new HTTPError(500, "DELETE_FAILED", `Failed to clear notifications: ${error.message}`);

    res.status(200).json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    next(error);
  }
};
