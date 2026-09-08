import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { queryClient } from "../lib/queryClient";

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
      const response = await fetchApi("/notifications");
      return response.data as Notification[];
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const response = await fetchApi("/notifications/unread-count");
      return response.count as number;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useMarkAsRead() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await fetchApi(`/notifications/${id}/read`, {
        method: "PATCH",
      });
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
      return await fetchApi("/notifications/read-all", {
        method: "PATCH",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}
