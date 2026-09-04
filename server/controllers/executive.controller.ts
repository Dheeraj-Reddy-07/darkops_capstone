import { Request, Response, NextFunction } from 'express';
import { createSupabaseServiceRoleClient } from '../lib/supabase';
import { DeterministicInsightsProvider } from '../services/insights.service';

export const getMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use service role to bypass RLS — auth is already verified by middleware before this runs
    const supabase = createSupabaseServiceRoleClient();
    
    // Get basic counts and pulse data
    const [{ count: storeCount }, { data: rawPulseData }, { count: activeCases }] = await Promise.all([
      supabase.from('stores').select('*', { count: 'exact', head: true }),
      supabase.from('pulse_scores').select('score, store_id, calculated_at'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).in('status', ['unassigned', 'assigned', 'in_progress', 'escalated_l2'])
    ]);

    // Group pulse data by store and take the latest
    const latestPulseScores = new Map<string, any>();
    if (rawPulseData) {
      rawPulseData.forEach(p => {
        const existing = latestPulseScores.get(p.store_id);
        if (!existing || new Date(p.calculated_at).getTime() > new Date(existing.calculated_at).getTime()) {
          latestPulseScores.set(p.store_id, p);
        }
      });
    }
    const pulseData = Array.from(latestPulseScores.values());

    // Calculate pulse metrics
    let avgPulse = 0;
    let criticalStores = 0;
    let atRiskStores = 0;
    
    if (pulseData.length > 0) {
      const sum = pulseData.reduce((acc, curr) => acc + curr.score, 0);
      avgPulse = Math.round(sum / pulseData.length);
      criticalStores = pulseData.filter(p => p.score < 60).length;
      atRiskStores = pulseData.filter(p => p.score >= 60 && p.score < 80).length;
    }

    // Count distinct cities across all stores (is_active is not reliably set by seed)
    const { data: storesByCity } = await supabase
      .from('stores')
      .select('city');

    const cityCount = new Set(storesByCity?.map((s) => s.city) || []).size;

    // Get city stats for city-wise complaints
    const { data: cityComplaints } = await supabase
      .from('complaints')
      .select('stores!inner(city)')
      .in('status', ['unassigned', 'assigned', 'in_progress', 'escalated_l2']);
    
    const cityStatsMap: Record<string, number> = {};
    cityComplaints?.forEach((c: any) => {
      const city = c.stores?.city || 'Unknown';
      cityStatsMap[city] = (cityStatsMap[city] || 0) + 1;
    });
    
    const cityStats = Object.entries(cityStatsMap)
      .map(([city, complaints]) => ({ city, complaints }))
      .sort((a, b) => b.complaints - a.complaints);

    // Get SLA metrics from complaints
    const { data: complaints } = await supabase
      .from('complaints')
      .select('sla_state, status, priority');
    
    const slaAtRisk = complaints?.filter(c => c.sla_state === 'at_risk').length || 0;
    const slaBreached = complaints?.filter(c => c.sla_state === 'breached').length || 0;
    const p1Cases = complaints?.filter(c => c.priority === 'P1').length || 0;
    const resolvedToday = complaints?.filter(c => c.status === 'resolved').length || 0;

    // Get fraud metrics
    const { count: pendingFraud } = await supabase
      .from('fraud_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('decision', 'pending_review');

    // Get 30-day volume series
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: recentComplaints } = await supabase
      .from('complaints')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo.toISOString());
    
    // Group by day for volume series
    const volumeByDay: Record<string, number> = {};
    recentComplaints?.forEach(c => {
      const day = new Date(c.created_at).toISOString().split('T')[0];
      volumeByDay[day] = (volumeByDay[day] || 0) + 1;
    });
    
    const volumeSeries = Object.entries(volumeByDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get worst performing stores with full details
    const { data: worstStoresData } = await supabase
      .from('stores')
      .select(`
        id,
        name,
        city,
        pulse_scores!inner(score, calculated_at),
        store_metrics_snapshots!inner(sla_pct, refund_rate_pct)
      `);

    const worstStores = worstStoresData?.map((s: any) => {
      // Sort pulse scores descending so we get the most recent one first
      const sortedPulseScores = s.pulse_scores?.sort((a: any, b: any) => new Date(b.calculated_at).getTime() - new Date(a.calculated_at).getTime()) || [];
      const currentPulse = sortedPulseScores[0]?.score || 0;
      const prevPulse = sortedPulseScores[7]?.score || currentPulse; // ~7 days ago

      return {
        id: s.id,
        name: s.name,
        city: s.city,
        pulse: currentPulse,
        sla: s.store_metrics_snapshots?.[0]?.sla_pct || 0,
        refundRate: s.store_metrics_snapshots?.[0]?.refund_rate_pct || 0,
        prevPulse: prevPulse, 
      };
    }).sort((a, b) => a.pulse - b.pulse).slice(0, 5) || [];

    // Get red alerts
    const { data: alerts } = await supabase
      .from('alerts')
      .select('*')
      .eq('severity', 'crit')
      .is('is_resolved', false);

    res.status(200).json({
      store_count: storeCount || 0,
      city_count: cityCount,
      critical_stores: criticalStores,
      at_risk_stores: atRiskStores,
      avg_pulse: avgPulse,
      active_cases: activeCases || 0,
      sla_at_risk: slaAtRisk,
      sla_breached: slaBreached,
      p1_cases: p1Cases,
      resolved_today: resolvedToday,
      pending_fraud: pendingFraud || 0,
      volume_series: volumeSeries,
      worst_stores: worstStores,
      red_alerts: alerts || [],
      city_stats: cityStats,
    });
  } catch (error) {
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
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      res.status(400).json({ error: { code: 'INVALID_QUESTION', message: 'question is required and must be a non-empty string' } });
      return;
    }
    const provider = new DeterministicInsightsProvider();
    const answer = await provider.chat(question.trim());
    res.status(200).json({ answer });
  } catch (error) {
    next(error);
  }
};
