import { createSupabaseServiceRoleClient } from "../lib/supabase";

export interface TimeRange {
  start: Date;
  end: Date;
  label: string;
}

export interface NetworkKPIs {
  storeCount: number;
  cityCount: number;
  avgPulse: number;
  criticalStores: number;
  atRiskStores: number;
  healthyStores: number;
  totalComplaints: number;
  activeCases: number;
  slaBreached: number;
  slaAtRisk: number;
  p1Cases: number;
  pendingFraud: number;
  activeCriticalAlerts: number;
  topCategory: { category: string; count: number } | null;
  topProblemStore: { id: string; name: string; city: string; complaints: number } | null;
}

export interface ComplaintAnalytics {
  total: number;
  byCategory: Array<{ category: string; count: number; percentage: number }>;
  byType: Array<{ type: string; count: number; percentage: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
  resolvedCount: number;
  resolutionRate: number;
  slaBreachedCount: number;
  slaBreachRate: number;
  totalRefundAmountPaise: number;
}

export interface StoreRankingItem {
  id: string;
  name: string;
  city: string;
  pulse: number;
  openComplaints: number;
  slaBreaches: number;
  refundRate: number;
}

export interface StoreDetailData {
  id: string;
  name: string;
  city: string;
  zone: string;
  managerName: string;
  pickers: number;
  riders: number;
  currentPulse: number;
  previousPulse?: number;
  pulseTrend: number; // positive = improving, negative = dropping
  complaintsCount: number;
  activeCases: number;
  slaBreaches: number;
  topCategories: Array<{ category: string; count: number }>;
  workOrders: Array<{ id: string; asset: string; priority: string; status: string }>;
  activeAlerts: Array<{ title: string; severity: string; detail: string }>;
  priorPeriodComplaints?: number;
  complaintsDeltaPct?: number;
}

export interface CityAnalyticsItem {
  city: string;
  storeCount: number;
  complaintsCount: number;
  avgPulse: number;
  slaBreaches: number;
  criticalStoresCount: number;
  worstStore: { id: string; name: string; pulse: number } | null;
}

export interface SLAAnalytics {
  activeTotal: number;
  onTrack: number;
  atRisk: number;
  breached: number;
  breachRate: number;
  p1Breaches: number;
  p2Breaches: number;
  p3Breaches: number;
  p4Breaches: number;
  byCity: Array<{ city: string; breaches: number }>;
}

export interface AutomationMetrics {
  totalComplaints: number;
  autoResolvedCount: number;
  manualQueueCount: number;
  autoResolutionRate: number;
  autoApprovedRefundsPaise: number;
}

export interface RiskAnalytics {
  pendingCount: number;
  reviewedCount: number;
  byDecision: Record<string, number>;
  affectedStores: Array<{ id: string; name: string; city: string; count: number }>;
  topReasons: Array<{ reason: string; count: number }>;
}

export interface AnomalyItem {
  type: "pulse_drop" | "critical_alert" | "complaint_spike" | "sla_cluster";
  severity: "crit" | "warn";
  title: string;
  description: string;
  entityId?: string;
  entityName?: string;
  metrics?: Record<string, any>;
}

export interface PeriodComparison {
  metric: string;
  currentValue: number;
  previousValue: number;
  difference: number;
  percentageChange: number;
  isRate: boolean;
  percentagePointChange?: number;
  currentPeriodLabel: string;
  previousPeriodLabel: string;
}

export class CopilotTools {
  private supabase = createSupabaseServiceRoleClient();

  /**
   * Helper: Safely calculate percentage change
   */
  calcPctChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  /**
   * 1. Overall Network KPIs
   */
  async getNetworkKPIs(timeRange: TimeRange): Promise<NetworkKPIs> {
    const [storesRes, pulseRes, complaintsRes, fraudRes, alertsRes] = await Promise.all([
      this.supabase.from("stores").select("id, name, city"),
      this.supabase
        .from("pulse_scores")
        .select("store_id, score, calculated_at")
        .order("calculated_at", { ascending: false })
        .limit(600),
      this.supabase
        .from("complaints")
        .select("id, store_id, status, priority, sla_state, category, created_at")
        .gte("created_at", timeRange.start.toISOString())
        .lte("created_at", timeRange.end.toISOString()),
      this.supabase
        .from("fraud_reviews")
        .select("id", { count: "exact", head: true })
        .eq("decision", "pending_review"),
      this.supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("severity", "crit")
        .is("is_resolved", false),
    ]);

    const stores = storesRes.data || [];
    const pulseRows = pulseRes.data || [];
    const complaints = complaintsRes.data || [];

    // Map latest pulse per store
    const latestPulse = new Map<string, number>();
    pulseRows.forEach((p: any) => {
      if (!latestPulse.has(p.store_id)) {
        latestPulse.set(p.store_id, p.score);
      }
    });

    const pulseScores = Array.from(latestPulse.values());
    const avgPulse = pulseScores.length
      ? Math.round(pulseScores.reduce((a, b) => a + b, 0) / pulseScores.length)
      : 70;

    const criticalStores = pulseScores.filter((s) => s < 60).length;
    const atRiskStores = pulseScores.filter((s) => s >= 60 && s < 80).length;
    const healthyStores = pulseScores.filter((s) => s >= 80).length;

    const activeStatuses = ["unassigned", "assigned", "in_progress", "escalated_l2"];
    const activeCases = complaints.filter((c: any) => activeStatuses.includes(c.status)).length;
    const slaBreached = complaints.filter((c: any) => c.sla_state === "breached").length;
    const slaAtRisk = complaints.filter((c: any) => c.sla_state === "at_risk").length;
    const p1Cases = complaints.filter((c: any) => c.priority === "P1").length;

    // Top Category
    const catCount: Record<string, number> = {};
    complaints.forEach((c: any) => {
      if (c.category) catCount[c.category] = (catCount[c.category] || 0) + 1;
    });
    const topCatEntry = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0];
    const topCategory = topCatEntry ? { category: topCatEntry[0], count: topCatEntry[1] } : null;

    // Top Problem Store
    const storeCountMap: Record<string, number> = {};
    complaints.forEach((c: any) => {
      if (c.store_id) storeCountMap[c.store_id] = (storeCountMap[c.store_id] || 0) + 1;
    });
    const topStoreEntry = Object.entries(storeCountMap).sort((a, b) => b[1] - a[1])[0];
    let topProblemStore: NetworkKPIs["topProblemStore"] = null;
    if (topStoreEntry) {
      const storeObj = stores.find((s: any) => s.id === topStoreEntry[0]);
      topProblemStore = {
        id: topStoreEntry[0],
        name: storeObj?.name || topStoreEntry[0],
        city: storeObj?.city || "Unknown",
        complaints: topStoreEntry[1],
      };
    }

    return {
      storeCount: stores.length,
      cityCount: new Set(stores.map((s: any) => s.city)).size,
      avgPulse,
      criticalStores,
      atRiskStores,
      healthyStores,
      totalComplaints: complaints.length,
      activeCases,
      slaBreached,
      slaAtRisk,
      p1Cases,
      pendingFraud: fraudRes.count || 0,
      activeCriticalAlerts: alertsRes.count || 0,
      topCategory,
      topProblemStore,
    };
  }

  /**
   * 2. Detailed Complaint Analytics
   */
  async getComplaintAnalytics(
    timeRange: TimeRange,
    filters?: { storeId?: string; city?: string; category?: string; priority?: string },
  ): Promise<ComplaintAnalytics> {
    let query = this.supabase
      .from("complaints")
      .select(
        "id, store_id, status, priority, type, category, sla_state, refund_amount_paise, created_at",
      )
      .gte("created_at", timeRange.start.toISOString())
      .lte("created_at", timeRange.end.toISOString());

    if (filters?.storeId) {
      query = query.eq("store_id", filters.storeId);
    }
    if (filters?.category) {
      query = query.eq("category", filters.category);
    }
    if (filters?.priority) {
      query = query.eq("priority", filters.priority);
    }

    const { data: rows = [] } = await query;
    let complaints = rows || [];

    // Filter by city if requested
    if (filters?.city) {
      const { data: storesInCity } = await this.supabase
        .from("stores")
        .select("id")
        .ilike("city", `%${filters.city}%`);
      const validStoreIds = new Set((storesInCity || []).map((s: any) => s.id));
      complaints = complaints.filter((c: any) => validStoreIds.has(c.store_id));
    }

    const total = complaints.length;
    const catMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};
    const prioMap: Record<string, number> = {};
    const statusMap: Record<string, number> = {};
    let totalRefundPaise = 0;
    let breached = 0;
    let resolved = 0;

    complaints.forEach((c: any) => {
      if (c.category) catMap[c.category] = (catMap[c.category] || 0) + 1;
      if (c.type) typeMap[c.type] = (typeMap[c.type] || 0) + 1;
      if (c.priority) prioMap[c.priority] = (prioMap[c.priority] || 0) + 1;
      if (c.status) statusMap[c.status] = (statusMap[c.status] || 0) + 1;
      if (c.sla_state === "breached") breached++;
      if (c.status === "resolved") resolved++;
      if (c.refund_amount_paise) totalRefundPaise += Number(c.refund_amount_paise);
    });

    return {
      total,
      byCategory: Object.entries(catMap)
        .map(([category, count]) => ({
          category,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count),
      byType: Object.entries(typeMap)
        .map(([type, count]) => ({
          type,
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count),
      byPriority: Object.entries(prioMap)
        .map(([priority, count]) => ({ priority, count }))
        .sort((a, b) => b.count - a.count),
      byStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
      resolvedCount: resolved,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      slaBreachedCount: breached,
      slaBreachRate: total > 0 ? Math.round((breached / total) * 100) : 0,
      totalRefundAmountPaise: totalRefundPaise,
    };
  }

  /**
   * 3. Store Rankings (Top problem stores, lowest PulseScore stores)
   */
  async getStoreRankings(
    rankBy: "pulse_asc" | "pulse_desc" | "complaints" | "sla_breaches",
    limit: number = 5,
    filters?: { city?: string },
  ): Promise<StoreRankingItem[]> {
    let storeQuery = this.supabase.from("stores").select("id, name, city");
    if (filters?.city) {
      storeQuery = storeQuery.ilike("city", `%${filters.city}%`);
    }
    const { data: stores = [] } = await storeQuery;
    if (!stores || stores.length === 0) return [];

    const storeIds = stores.map((s: any) => s.id);

    // Pulse scores
    const { data: pulseRows = [] } = await this.supabase
      .from("pulse_scores")
      .select("store_id, score, calculated_at")
      .in("store_id", storeIds.slice(0, 200))
      .order("calculated_at", { ascending: false });

    const latestPulse = new Map<string, number>();
    (pulseRows || []).forEach((p: any) => {
      if (!latestPulse.has(p.store_id)) latestPulse.set(p.store_id, p.score);
    });

    // Complaints in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: complaintRows = [] } = await this.supabase
      .from("complaints")
      .select("store_id, sla_state, status")
      .gte("created_at", thirtyDaysAgo)
      .in("store_id", storeIds.slice(0, 200));

    const complaintCounts: Record<string, number> = {};
    const breachCounts: Record<string, number> = {};

    (complaintRows || []).forEach((c: any) => {
      complaintCounts[c.store_id] = (complaintCounts[c.store_id] || 0) + 1;
      if (c.sla_state === "breached") {
        breachCounts[c.store_id] = (breachCounts[c.store_id] || 0) + 1;
      }
    });

    const items: StoreRankingItem[] = stores.map((s: any) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      pulse: latestPulse.get(s.id) ?? 70,
      openComplaints: complaintCounts[s.id] || 0,
      slaBreaches: breachCounts[s.id] || 0,
      refundRate: 0,
    }));

    if (rankBy === "pulse_asc") {
      items.sort((a, b) => a.pulse - b.pulse);
    } else if (rankBy === "pulse_desc") {
      items.sort((a, b) => b.pulse - a.pulse);
    } else if (rankBy === "complaints") {
      items.sort((a, b) => b.openComplaints - a.openComplaints || a.pulse - b.pulse);
    } else if (rankBy === "sla_breaches") {
      items.sort((a, b) => b.slaBreaches - a.slaBreaches || a.pulse - b.pulse);
    }

    return items.slice(0, limit);
  }

  /**
   * 4. Single Store Deep-Dive
   */
  async getStoreDetail(
    storeId: string,
    timeRange: TimeRange,
    compareRange?: TimeRange,
  ): Promise<StoreDetailData | null> {
    const { data: store } = await this.supabase
      .from("stores")
      .select("*")
      .eq("id", storeId)
      .maybeSingle();

    if (!store) return null;

    // Pulse history
    const { data: pulseHistory = [] } = await this.supabase
      .from("pulse_scores")
      .select("score, calculated_at")
      .eq("store_id", storeId)
      .order("calculated_at", { ascending: false })
      .limit(10);

    const currentPulse = pulseHistory?.[0]?.score ?? 70;
    const previousPulse = pulseHistory?.[1]?.score ?? currentPulse;
    const pulseTrend = currentPulse - previousPulse;

    // Current period complaints
    const complaintsRes = await this.supabase
      .from("complaints")
      .select("id, category, status, priority, sla_state, created_at")
      .eq("store_id", storeId)
      .gte("created_at", timeRange.start.toISOString())
      .lte("created_at", timeRange.end.toISOString());
    const complaints = complaintsRes.data || [];

    const catCount: Record<string, number> = {};
    let slaBreaches = 0;
    let activeCases = 0;
    const activeStatuses = ["unassigned", "assigned", "in_progress", "escalated_l2"];

    complaints.forEach((c: any) => {
      if (c.category) catCount[c.category] = (catCount[c.category] || 0) + 1;
      if (c.sla_state === "breached") slaBreaches++;
      if (activeStatuses.includes(c.status)) activeCases++;
    });

    const topCategories = Object.entries(catCount)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Active work orders for equipment
    const workOrdersRes = await this.supabase
      .from("work_orders")
      .select("id, asset_name, priority, status")
      .eq("store_id", storeId)
      .neq("status", "resolved")
      .limit(5);
    const workOrders = workOrdersRes.data || [];

    // Active alerts
    const alertsRes = await this.supabase
      .from("alerts")
      .select("title, severity, detail")
      .eq("store_id", storeId)
      .eq("is_resolved", false)
      .limit(5);
    const alerts = alertsRes.data || [];

    // Comparison period complaints if requested
    let priorPeriodComplaints: number | undefined;
    let complaintsDeltaPct: number | undefined;

    if (compareRange) {
      const priorComplaintsRes = await this.supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .eq("store_id", storeId)
        .gte("created_at", compareRange.start.toISOString())
        .lte("created_at", compareRange.end.toISOString());

      priorPeriodComplaints = priorComplaintsRes.count || priorComplaintsRes.data?.length || 0;
      complaintsDeltaPct = this.calcPctChange(complaints.length, priorPeriodComplaints || 0);
    }

    return {
      id: store.id,
      name: store.name,
      city: store.city,
      zone: store.zone,
      managerName: store.manager_name,
      pickers: store.pickers_on_shift,
      riders: store.riders_assigned,
      currentPulse,
      previousPulse,
      pulseTrend,
      complaintsCount: complaints.length,
      activeCases,
      slaBreaches,
      topCategories,
      workOrders: workOrders.map((w: any) => ({
        id: w.id,
        asset: w.asset_name,
        priority: w.priority,
        status: w.status,
      })),
      activeAlerts: alerts.map((a: any) => ({
        title: a.title,
        severity: a.severity,
        detail: a.detail,
      })),
      priorPeriodComplaints,
      complaintsDeltaPct,
    };
  }

  /**
   * 5. City-Level Analytics
   */
  async getCityAnalytics(timeRange: TimeRange): Promise<CityAnalyticsItem[]> {
    const storesRes = await this.supabase.from("stores").select("id, name, city");
    const stores = storesRes.data || [];
    if (!stores.length) return [];

    const complaintsRes = await this.supabase
      .from("complaints")
      .select("store_id, sla_state")
      .gte("created_at", timeRange.start.toISOString())
      .lte("created_at", timeRange.end.toISOString());
    const complaints = complaintsRes.data || [];

    const pulseRes = await this.supabase
      .from("pulse_scores")
      .select("store_id, score, calculated_at")
      .order("calculated_at", { ascending: false })
      .limit(600);
    const pulseRows = pulseRes.data || [];

    const latestPulse = new Map<string, number>();
    pulseRows.forEach((p: any) => {
      if (!latestPulse.has(p.store_id)) latestPulse.set(p.store_id, p.score);
    });

    const cityMap: Record<
      string,
      {
        stores: typeof stores;
        complaints: number;
        breaches: number;
        pulseScores: number[];
      }
    > = {};

    stores.forEach((s: any) => {
      if (!cityMap[s.city]) {
        cityMap[s.city] = { stores: [], complaints: 0, breaches: 0, pulseScores: [] };
      }
      cityMap[s.city]!.stores.push(s);
      const score = latestPulse.get(s.id);
      if (score !== undefined) cityMap[s.city]!.pulseScores.push(score);
    });

    const storeCity = new Map<string, string>();
    stores.forEach((s: any) => storeCity.set(s.id, s.city));

    complaints.forEach((c: any) => {
      const city = storeCity.get(c.store_id);
      if (city && cityMap[city]) {
        cityMap[city]!.complaints++;
        if (c.sla_state === "breached") cityMap[city]!.breaches++;
      }
    });

    return Object.entries(cityMap)
      .map(([city, data]) => {
        const avgPulse = data.pulseScores.length
          ? Math.round(data.pulseScores.reduce((a, b) => a + b, 0) / data.pulseScores.length)
          : 70;
        const criticalStoresCount = data.pulseScores.filter((s) => s < 60).length;

        // Find worst store in city
        let worstStore: CityAnalyticsItem["worstStore"] = null;
        let minPulse = 101;
        data.stores.forEach((s: any) => {
          const score = latestPulse.get(s.id) ?? 70;
          if (score < minPulse) {
            minPulse = score;
            worstStore = { id: s.id, name: s.name, pulse: score };
          }
        });

        return {
          city,
          storeCount: data.stores.length,
          complaintsCount: data.complaints,
          avgPulse,
          slaBreaches: data.breaches,
          criticalStoresCount,
          worstStore,
        };
      })
      .sort((a, b) => b.complaintsCount - a.complaintsCount);
  }

  /**
   * 6. SLA Analytics
   */
  async getSLAAnalytics(
    timeRange: TimeRange,
    filters?: { city?: string; storeId?: string },
  ): Promise<SLAAnalytics> {
    const storesRes = await this.supabase.from("stores").select("id, city");
    const stores = storesRes.data || [];
    const storeCityMap = new Map<string, string>();
    stores.forEach((s: any) => storeCityMap.set(s.id, s.city));

    let query = this.supabase
      .from("complaints")
      .select("store_id, priority, sla_state, status, created_at")
      .gte("created_at", timeRange.start.toISOString())
      .lte("created_at", timeRange.end.toISOString());

    if (filters?.storeId) query = query.eq("store_id", filters.storeId);

    const complaintsRes = await query;
    const complaints = complaintsRes.data || [];

    const activeStatuses = ["unassigned", "assigned", "in_progress", "escalated_l2"];
    const active = complaints.filter((c: any) => activeStatuses.includes(c.status));

    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;
    let p1Breaches = 0;
    let p2Breaches = 0;
    let p3Breaches = 0;
    let p4Breaches = 0;

    const cityBreaches: Record<string, number> = {};

    active.forEach((c: any) => {
      if (c.sla_state === "on_track") onTrack++;
      else if (c.sla_state === "at_risk") atRisk++;
      else if (c.sla_state === "breached") {
        breached++;
        if (c.priority === "P1") p1Breaches++;
        else if (c.priority === "P2") p2Breaches++;
        else if (c.priority === "P3") p3Breaches++;
        else if (c.priority === "P4") p4Breaches++;

        const city = storeCityMap.get(c.store_id) || "Other";
        cityBreaches[city] = (cityBreaches[city] || 0) + 1;
      }
    });

    const activeTotal = active.length;
    return {
      activeTotal,
      onTrack,
      atRisk,
      breached,
      breachRate: activeTotal > 0 ? Math.round((breached / activeTotal) * 100) : 0,
      p1Breaches,
      p2Breaches,
      p3Breaches,
      p4Breaches,
      byCity: Object.entries(cityBreaches)
        .map(([city, breaches]) => ({ city, breaches }))
        .sort((a, b) => b.breaches - a.breaches),
    };
  }

  /**
   * 7. Automation Performance
   */
  async getAutomationMetrics(timeRange: TimeRange): Promise<AutomationMetrics> {
    const complaintsRes = await this.supabase
      .from("complaints")
      .select("id, status, automation_result, refund_amount_paise, created_at")
      .gte("created_at", timeRange.start.toISOString())
      .lte("created_at", timeRange.end.toISOString());
    const complaints = complaintsRes.data || [];

    let autoResolved = 0;
    let manualQueue = 0;
    let autoRefundPaise = 0;

    complaints.forEach((c: any) => {
      const isAuto =
        c.automation_result?.toLowerCase().includes("auto-approved") ||
        c.automation_result?.toLowerCase().includes("auto-resolve") ||
        (c.status === "resolved" && c.automation_result);

      if (isAuto) {
        autoResolved++;
        if (c.refund_amount_paise) autoRefundPaise += Number(c.refund_amount_paise);
      } else {
        manualQueue++;
      }
    });

    const total = complaints.length;
    return {
      totalComplaints: total,
      autoResolvedCount: autoResolved,
      manualQueueCount: manualQueue,
      autoResolutionRate: total > 0 ? Math.round((autoResolved / total) * 100) : 0,
      autoApprovedRefundsPaise: autoRefundPaise,
    };
  }

  /**
   * 8. Risk & Fraud Review Analytics
   */
  async getRiskAnalytics(): Promise<RiskAnalytics> {
    const reviewsRes = await this.supabase
      .from("fraud_reviews")
      .select(
        "id, complaint_id, decision, reason, risk_confidence, complaints(store_id, stores(name, city))",
      );
    const reviews = reviewsRes.data || [];

    let pendingCount = 0;
    let reviewedCount = 0;
    const byDecision: Record<string, number> = {};
    const storeCountMap: Record<string, { name: string; city: string; count: number }> = {};
    const reasonCountMap: Record<string, number> = {};

    reviews.forEach((r: any) => {
      const dec = r.decision || "pending_review";
      byDecision[dec] = (byDecision[dec] || 0) + 1;
      if (dec === "pending_review") pendingCount++;
      else reviewedCount++;

      if (r.reason) {
        reasonCountMap[r.reason] = (reasonCountMap[r.reason] || 0) + 1;
      }

      const storeId = r.complaints?.store_id;
      if (storeId) {
        if (!storeCountMap[storeId]) {
          storeCountMap[storeId] = {
            name: r.complaints?.stores?.name || storeId,
            city: r.complaints?.stores?.city || "Unknown",
            count: 0,
          };
        }
        storeCountMap[storeId].count++;
      }
    });

    const affectedStores = Object.entries(storeCountMap)
      .map(([id, info]) => ({ id, name: info.name, city: info.city, count: info.count }))
      .sort((a, b) => b.count - a.count);

    const topReasons = Object.entries(reasonCountMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return {
      pendingCount,
      reviewedCount,
      byDecision,
      affectedStores,
      topReasons,
    };
  }

  /**
   * 9. Anomalies and Operational Alerts
   */
  async getAnomaliesAndAlerts(): Promise<AnomalyItem[]> {
    const anomalies: AnomalyItem[] = [];

    // 1. Critical active alerts
    const alertsRes = await this.supabase
      .from("alerts")
      .select("id, store_id, title, detail, severity, stores(name, city)")
      .eq("severity", "crit")
      .eq("is_resolved", false)
      .limit(6);
    const alerts = alertsRes.data || [];

    alerts.forEach((a: any) => {
      anomalies.push({
        type: "critical_alert",
        severity: "crit",
        title: a.title,
        description: `${a.stores?.name || a.store_id} (${a.stores?.city || "Unknown"}): ${a.detail}`,
        entityId: a.store_id,
        entityName: a.stores?.name,
      });
    });

    // 2. Stores with lowest PulseScore (< 50)
    const worstPulseRes = await this.supabase
      .from("pulse_scores")
      .select("store_id, score, calculated_at, stores(name, city)")
      .order("calculated_at", { ascending: false })
      .limit(200);
    const worstPulse = worstPulseRes.data || [];

    const storePulse = new Map<string, { score: number; name: string; city: string }>();
    worstPulse.forEach((p: any) => {
      if (!storePulse.has(p.store_id)) {
        storePulse.set(p.store_id, {
          score: p.score,
          name: p.stores?.name || p.store_id,
          city: p.stores?.city || "Unknown",
        });
      }
    });

    const criticalStores = Array.from(storePulse.entries())
      .filter(([_, data]) => data.score < 50)
      .sort((a, b) => a[1].score - b[1].score);

    criticalStores.slice(0, 3).forEach(([id, data]) => {
      anomalies.push({
        type: "pulse_drop",
        severity: "crit",
        title: `Critical Store Health: ${data.name}`,
        description: `${data.name} in ${data.city} has dropped to a PulseScore of ${data.score}/100. Immediate intervention required.`,
        entityId: id,
        entityName: data.name,
      });
    });

    return anomalies;
  }

  /**
   * 10. Period Comparison Tool
   */
  async comparePeriods(
    metricType: "complaints" | "sla_breaches" | "auto_resolution",
    currentRange: TimeRange,
    priorRange: TimeRange,
    filters?: { storeId?: string; city?: string },
  ): Promise<PeriodComparison> {
    const [currentAnalytics, priorAnalytics] = await Promise.all([
      this.getComplaintAnalytics(currentRange, filters),
      this.getComplaintAnalytics(priorRange, filters),
    ]);

    if (metricType === "complaints") {
      const cur = currentAnalytics.total;
      const prior = priorAnalytics.total;
      const diff = cur - prior;
      return {
        metric: "Complaint Volume",
        currentValue: cur,
        previousValue: prior,
        difference: diff,
        percentageChange: this.calcPctChange(cur, prior),
        isRate: false,
        currentPeriodLabel: currentRange.label,
        previousPeriodLabel: priorRange.label,
      };
    } else if (metricType === "sla_breaches") {
      const cur = currentAnalytics.slaBreachedCount;
      const prior = priorAnalytics.slaBreachedCount;
      const diff = cur - prior;
      return {
        metric: "SLA Breaches",
        currentValue: cur,
        previousValue: prior,
        difference: diff,
        percentageChange: this.calcPctChange(cur, prior),
        isRate: false,
        currentPeriodLabel: currentRange.label,
        previousPeriodLabel: priorRange.label,
      };
    } else {
      const cur = currentAnalytics.resolutionRate;
      const prior = priorAnalytics.resolutionRate;
      const diff = cur - prior;
      return {
        metric: "Resolution Rate",
        currentValue: cur,
        previousValue: prior,
        difference: diff,
        percentageChange: this.calcPctChange(cur, prior),
        isRate: true,
        percentagePointChange: diff,
        currentPeriodLabel: currentRange.label,
        previousPeriodLabel: priorRange.label,
      };
    }
  }
}
