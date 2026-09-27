import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { createSupabaseBrowserClient } from "../lib/supabase/client";

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  meta: string;
  link_type: string;
  link_ref: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      // 1. Try Express backend API first
      try {
        const response = await fetchApi("/notifications");
        if (response && Array.isArray(response.data)) {
          return response.data as Notification[];
        }
      } catch (err) {
        console.warn("[Notifications] API call failed, falling back to direct Supabase query:", err);
      }

      // 2. Direct Supabase fallback (guarantees notifications work on Netlify/production)
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return [];

        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          console.error("[Notifications] Direct Supabase fetch error:", error);
          return [];
        }
        return (data || []) as Notification[];
      } catch (fallbackErr) {
        console.error("[Notifications] Fallback error:", fallbackErr);
        return [];
      }
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      // 1. Try Express backend API first
      try {
        const response = await fetchApi("/notifications/unread-count");
        if (response && typeof response.count === "number") {
          return response.count as number;
        }
      } catch {
        /* fallback below */
      }

      // 2. Direct Supabase fallback
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return 0;

        const { count, error } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("is_read", false);

        return error ? 0 : (count || 0);
      } catch {
        return 0;
      }
    },
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await fetchApi(`/notifications/${id}/read`, {
          method: "PATCH",
        });
      } catch {
        const supabase = createSupabaseBrowserClient();
        return await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useMarkAllAsRead() {
  return useMutation({
    mutationFn: async () => {
      try {
        return await fetchApi("/notifications/read-all", {
          method: "PATCH",
        });
      } catch {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        return await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("recipient_id", user.id)
          .eq("is_read", false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useDeleteNotification() {
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await fetchApi(`/notifications/${id}`, {
          method: "DELETE",
        });
      } catch {
        const supabase = createSupabaseBrowserClient();
        return await supabase
          .from("notifications")
          .delete()
          .eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}
