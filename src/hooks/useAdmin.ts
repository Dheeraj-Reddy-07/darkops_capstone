import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  hub_city: string | null;
  store_id: string | null;
  is_active: boolean;
  created_at: string;
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const response = await fetchApi("/admin/users");
      return response.data as AdminUser[];
    },
  });
}

export function useUpdateUserRole() {
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return await fetchApi(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const response = await fetchApi("/admin/audit-logs?limit=100");
      return response.data;
    },
  });
}

export function useSystemStats() {
  return useQuery({
    queryKey: ["system-stats"],
    queryFn: async () => {
      const response = await fetchApi("/admin/stats");
      return response;
    },
  });
}
