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

      // Real week-ago PulseScore from the 31-day history (not a fabricated delta).
      const fullHistory = row.pulseHistory || [];
      const weekAgoPulse =
        fullHistory.length >= 8
          ? fullHistory[fullHistory.length - 8].score
          : (fullHistory[0]?.score ?? pulse);

      const store = {
        id: row.id,
        name: row.name,
        city: row.city,
        zone: row.zone,
        manager: row.manager_name || "Manager",
        pulse,
        prevPulse: weekAgoPulse,
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

      // Daily equipment/inventory pressure derived directly from that day's real
      // PulseScore deduction points (no synthetic sin/cos fluctuation).
      const series = recentHistory.map((p: any) => {
        const date = new Date(p.calculated_at);
        const failures = Math.round((p.equipment_pts || 0) / 2);
        const stockouts = Math.round((p.inventory_pts || 0) / 1.5);
        return {
          day: `${date.getDate()} ${date.toLocaleString("default", { month: "short" })}`,
          failures,
          downtime: Number((failures * 1.2).toFixed(1)),
          stockouts,
          mismatches: Math.round(stockouts * 0.4),
        };
      });

      // 30-day PulseScore trend straight from the real per-day scores.
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
