import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";

/**
 * GET /api/v1/public/overview
 *
 * Returns safe, aggregate-only network statistics for the public landing page.
 * No authentication required. No PII. No fraud-sensitive details.
 * Only safe aggregate counts are exposed.
 */
export const getPublicOverview = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServiceRoleClient();

    const [
      { count: storeCount },
      { count: activeCases },
      { data: pulseData },
      { count: pendingFraud },
    ] = await Promise.all([
      // Active store count (is_active not filtered — column set by seed upsert)
      supabase.from("stores").select("*", { count: "exact", head: true }),

      // Open operational cases (unassigned, assigned, in_progress, escalated)
      supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .in("status", ["unassigned", "assigned", "in_progress", "escalated_l2"]),

      // Pulse scores for computing network average
      supabase.from("pulse_scores").select("score"),

      // Open fraud review queue — count only, no case details
      supabase
        .from("fraud_reviews")
        .select("*", { count: "exact", head: true })
        .eq("decision", "pending_review"),
    ]);

    // Compute network average PulseScore
    let avgPulse = 0;
    if (pulseData && pulseData.length > 0) {
      const sum = pulseData.reduce((acc, curr) => acc + curr.score, 0);
      avgPulse = Math.round(sum / pulseData.length);
    }

    res.status(200).json({
      store_count: storeCount ?? 0,
      active_cases: activeCases ?? 0,
      avg_pulse: avgPulse,
      pending_fraud: pendingFraud ?? 0,
    });
  } catch (error) {
    next(error);
  }
};
