import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { DeterministicInsightsProvider } from "../services/insights.service";
import { ExecutiveAssistantService } from "../services/executive-assistant.service";

let metricsCache: { data: any; expiresAt: number } | null = null;

export const getMetrics = async (req: Request, res: Response, next: NextFunction) => {
  const reqStart = Date.now();
  const requestId = (req as any).requestId || "unknown";
  console.log(`[GET_METRICS_START] RequestID: ${requestId}`);

  // Return cached metrics if fresh (< 15 seconds)
  if (metricsCache && Date.now() < metricsCache.expiresAt) {
    console.log(`[GET_METRICS_CACHE_HIT] RequestID: ${requestId}, serving cached in ${Date.now() - reqStart}ms`);
    return res.status(200).json(metricsCache.data);
  }

  try {
    const supabase = createSupabaseServiceRoleClient();

    // 5 clean, non-blocking queries in parallel
    const [
      storesResult,
      complaintsResult,
      pulseResult,
      fraudResult,
      alertsResult,
    ] = await Promise.all([
      // 1. Stores with their snapshots
      supabase
        .from("stores")
        .select("id, name, city, store_metrics_snapshots(sla_pct, refund_rate_pct)"),
      // 2. All complaints (small table, ~92 rows) with all fields needed
      supabase
        .from("complaints")
        .select("id, store_id, status, priority, sla_state, created_at"),
      // 3. Latest pulse scores
      supabase
        .from("pulse_scores")
        .select("store_id, score, calculated_at")
        .order("calculated_at", { ascending: false })
        .limit(600),
      // 4. Pending fraud reviews count
      supabase
        .from("fraud_reviews")
        .select("id", { count: "exact", head: true })
        .eq("decision", "pending_review"),
      // 5. Active critical alerts
      supabase
        .from("alerts")
        .select("*")
        .eq("severity", "crit")
        .is("is_resolved", false),
    ]);

    console.log(`[GET_METRICS_QUERIES_DONE] Queries finished in ${Date.now() - reqStart}ms`);

    const stores = storesResult.data || [];
    const complaints = complaintsResult.data || [];
    const pulseScores = pulseResult.data || [];

    // Map latest pulse score per store
    const latestPulseMap = new Map<string, { score: number; calculated_at: string }>();
    pulseScores.forEach((p) => {
      const existing = latestPulseMap.get(p.store_id);
      if (!existing || new Date(p.calculated_at).getTime() > new Date(existing.calculated_at).getTime()) {
        latestPulseMap.set(p.store_id, p);
      }
    });

    // Store city lookup
    const storeCityMap = new Map<string, string>();
    stores.forEach((s) => storeCityMap.set(s.id, s.city));

    // Pulse aggregations
    const pulseValues = Array.from(latestPulseMap.values());
    let avgPulse = 0;
    let criticalStores = 0;
    let atRiskStores = 0;
    if (pulseValues.length > 0) {
      const sum = pulseValues.reduce((acc, curr) => acc + curr.score, 0);
      avgPulse = Math.round(sum / pulseValues.length);
      criticalStores = pulseValues.filter((p) => p.score < 60).length;
      atRiskStores = pulseValues.filter((p) => p.score >= 60 && p.score < 80).length;
    }

    // Complaints aggregations
    const activeStatuses = ["unassigned", "assigned", "in_progress", "escalated_l2"];
    const activeCases = complaints.filter((c) => activeStatuses.includes(c.status)).length;
    const slaAtRisk = complaints.filter((c) => c.sla_state === "at_risk").length;
    const slaBreached = complaints.filter((c) => c.sla_state === "breached").length;
    const p1Cases = complaints.filter((c) => c.priority === "P1").length;
    const resolvedToday = complaints.filter((c) => c.status === "resolved").length;

    // City stats
    const cityStatsMap: Record<string, number> = {};
    complaints
      .filter((c) => activeStatuses.includes(c.status))
      .forEach((c) => {
        const city = storeCityMap.get(c.store_id) || "Unknown";
        cityStatsMap[city] = (cityStatsMap[city] || 0) + 1;
      });
    const cityStats = Object.entries(cityStatsMap)
      .map(([city, complaintsCount]) => ({ city, complaints: complaintsCount }))
      .sort((a, b) => b.complaints - a.complaints);

    // 30-day volume series
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const volumeByDay: Record<string, number> = {};
    complaints
      .filter((c) => new Date(c.created_at) >= thirtyDaysAgo)
      .forEach((c) => {
        const day = new Date(c.created_at).toISOString().split("T")[0];
        volumeByDay[day] = (volumeByDay[day] || 0) + 1;
      });
    const volumeSeries = Object.entries(volumeByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Worst stores
    const worstStores = stores
      .map((s: any) => {
        const pulse = latestPulseMap.get(s.id)?.score ?? 70;
        return {
          id: s.id,
          name: s.name,
          city: s.city,
          pulse,
          sla: s.store_metrics_snapshots?.[0]?.sla_pct || 0,
          refundRate: s.store_metrics_snapshots?.[0]?.refund_rate_pct || 0,
          prevPulse: pulse,
        };
      })
      .sort((a: any, b: any) => a.pulse - b.pulse)
      .slice(0, 5);

    const resultData = {
      store_count: stores.length,
      city_count: new Set(stores.map((s) => s.city)).size,
      critical_stores: criticalStores,
      at_risk_stores: atRiskStores,
      avg_pulse: avgPulse,
      active_cases: activeCases,
      sla_at_risk: slaAtRisk,
      sla_breached: slaBreached,
      p1_cases: p1Cases,
      resolved_today: resolvedToday,
      pending_fraud: fraudResult.count || 0,
      volume_series: volumeSeries,
      worst_stores: worstStores,
      red_alerts: alertsResult.data || [],
      city_stats: cityStats,
    };

    // Cache for 15s
    metricsCache = {
      data: resultData,
      expiresAt: Date.now() + 15000,
    };

    console.log(`[GET_METRICS_SUCCESS] Sending response in ${Date.now() - reqStart}ms`);
    return res.status(200).json(resultData);
  } catch (error) {
    console.error(`[GET_METRICS_ERROR] in ${Date.now() - reqStart}ms:`, error);
    next(error);
  }

};

export const getInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = new DeterministicInsightsProvider();
    const insights = await provider.generateInsights();
    res.status(200).json({ insights });
  } catch (error) {
    next(error);
  }
};

export const chatInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      res.status(400).json({
        error: {
          code: "INVALID_QUESTION",
          message: "question is required and must be a non-empty string",
        },
      });
      return;
    }
    const provider = new DeterministicInsightsProvider();
    const answer = await provider.chat(question.trim());
    res.status(200).json({ answer });
  } catch (error) {
    next(error);
  }
};

export const assistantQuery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { question, context } = req.body;
    
    if (!question || typeof question !== "string" || question.trim().length === 0) {
      res.status(400).json({
        error: {
          code: "INVALID_QUESTION",
          message: "question is required and must be a non-empty string",
        },
      });
      return;
    }

    const assistant = new ExecutiveAssistantService();
    const response = await assistant.query(question.trim(), context);
    
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
