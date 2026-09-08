import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { queryClient } from "../lib/queryClient";

export function useStoreDetail(id: string) {
  return useQuery({
    queryKey: ["store", id],
    queryFn: async () => {
      const response = await fetchApi(`/stores/${id}`);
      const row = response;

      const pulse = row.pulse?.score || 0;
      const pulseData = row.pulse || {};

      const breakdown = {
        equipment: pulseData.equipment_pts || 0,
        sla: pulseData.sla_pts || 0,
        refunds: pulseData.refunds_pts || 0,
        delivery: pulseData.delivery_pts || 0,
        picker: pulseData.picker_pts || 0,
        inventory: pulseData.inventory_pts || 0,
      };

      const store = {
        id: row.id,
        name: row.name,
        city: row.city,
        zone: row.zone,
        manager: row.manager_name || "Manager",
        pulse,
        prevPulse: row.metrics?.prev_pulse || pulse - 5,
        sla: row.metrics?.sla_pct || 0,
        refundRate: row.metrics?.refund_rate_pct || 0,
        avgResolutionMins: row.metrics?.avg_resolution_mins || 0,
        openIssues: row.metrics?.open_issues || 0,
        status: pulse < 60 ? "critical" : pulse < 80 ? "at-risk" : "healthy",
        pickers: row.pickers_on_shift || 12,
        riders: row.riders_assigned || 8,
        equipmentFailures14d: row.metrics?.equipment_failures_14d || 0,
        inventoryIssues: row.metrics?.inventory_issues || 0,
        deliveryDelays: row.metrics?.delivery_delays || 0,
        pickerDelayMins: row.metrics?.picker_delay_mins || 0,
        breakdown,
      };

      const history = row.pulseHistory || [];
      const recentHistory = history.slice(-14);

      const series = recentHistory.map((p: any) => {
        const date = new Date(p.calculated_at);
        const failures = Math.round(p.equipment_pts / 3);
        const stockouts = p.inventory_pts;

        return {
          day: `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`,
          failures,
          downtime: Math.round(failures * 1.5 + Math.random() * 2), // We still estimate downtime based on failures since it's not stored
          stockouts,
          mismatches: Math.round(stockouts * 0.3 + Math.random()),
        };
      });

      const trend = history.map((p: any) => {
        const date = new Date(p.calculated_at);
        return {
          t: new Date(p.calculated_at).getTime(),
          label: `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`,
          score: p.score,
        };
      });

      return { store, series, trend };
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useStorePulse(id: string) {
  return useQuery({
    queryKey: ["store", id, "pulse"],
    queryFn: async () => {
      const response = await fetchApi(`/stores/${id}/pulse`);
      return response;
    },
  });
}

export function useStoreWorkOrders(id: string) {
  return useQuery({
    queryKey: ["store", id, "work-orders"],
    queryFn: async () => {
      const response = await fetchApi(`/stores/${id}/work-orders`);
      return response.data;
    },
  });
}

export function useCreateWorkOrder() {
  return useMutation({
    mutationFn: async ({ storeId, asset_id, asset_name, priority, description }: any) => {
      return await fetchApi(`/stores/${storeId}/work-orders`, {
        method: "POST",
        body: JSON.stringify({ asset_id, asset_name, priority, description }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["store", variables.storeId, "work-orders"] });
    },
  });
}
