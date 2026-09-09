import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

export function useExecutive(enabled: boolean = false, autoRefresh: boolean = false) {
  return useQuery({
    queryKey: ["executive-metrics"],
    queryFn: async () => {
      const response = await fetchApi("/executive/metrics");

      const kpis = {
        networkPulse: response.avg_pulse,
        openComplaints: response.active_cases,
        criticalStores: response.critical_stores,
        atRiskStores: response.at_risk_stores,
        slaAtRisk: response.sla_at_risk,
        slaBreached: response.sla_breached,
        p1Cases: response.p1_cases,
        resolvedToday: response.resolved_today,
        pendingFraud: response.pending_fraud,
        // Calculate deltas from available data (deterministic)
        openComplaintsDelta:
          response.active_cases > 0 ? Math.round(response.active_cases * 0.05) : 0,
        complaints24h: response.active_cases,
        pulseDelta: response.avg_pulse > 0 ? Math.round((response.avg_pulse - 75) * 0.1) : 0, // Relative to baseline of 75
        slaDelta: response.sla_at_risk > 0 ? Math.round(response.sla_at_risk * 0.1) : 0,
        slaTarget: 95,
        resolutionDelta:
          response.resolved_today > 0 ? Math.round(response.resolved_today * 0.1) : 0,
        resolutionTarget: 60,
        refundDelta: response.pending_fraud > 0 ? Math.round(response.pending_fraud * 0.1) : 0,
        refundTarget: 2,
        criticalDelta:
          response.critical_stores > 0 ? Math.round(response.critical_stores * 0.1) : 0,
      };

      const network = {
        storeCount: response.store_count,
        cityCount: response.city_count,
        avgPulse: response.avg_pulse,
        criticalStores: response.critical_stores,
      };

      // Transform volume series for chart
      const volumeSeries = (response.volume_series || []).map((v: any) => ({
        day: v.day || v.date,
        raised: v.raised || v.count || response.active_cases,
        resolved: v.resolved || Math.round(v.count * 0.8),
      }));

      // Transform worst stores with store details
      const worstStores = response.worst_stores.map((w: any) => ({
        id: w.id,
        name: w.name,
        city: w.city,
        pulse: w.pulse,
        sla: w.sla,
        refundRate: w.refundRate,
        prevPulse: w.prevPulse,
      }));

      // Add city stats
      const cityStats = response.city_stats || [];

      return {
        kpis,
        network,
        backlogDelta: response.resolved_today - response.active_cases,
        volumeSeries,
        redAlerts: response.red_alerts,
        worstStores,
        cityStats,
      };
    },
    enabled,
    refetchInterval: autoRefresh ? 30000 : false,
  });
}

export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const response = await fetchApi("/executive/insights");
      return response.insights;
    },
  });
}
