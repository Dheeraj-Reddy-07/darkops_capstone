import {
  CopilotTools,
  TimeRange,
  NetworkKPIs,
  ComplaintAnalytics,
  StoreRankingItem,
  StoreDetailData,
  CityAnalyticsItem,
  SLAAnalytics,
  AutomationMetrics,
  RiskAnalytics,
  AnomalyItem,
} from "./copilot-tools";

export interface AssistantResponse {
  intent: string;
  answer: string;
  summary: string;
  metrics: Array<{ label: string; value: string; tone?: "ok" | "warn" | "crit" | "neutral" }>;
  evidence: Array<{ label: string; value: string }>;
  suggestedQuestions: string[];
  drillDown?: { label: string; route: string; params?: Record<string, string> };
  context?: {
    lastIntent?: string;
    lastStore?: string;
    lastCity?: string;
    lastCategory?: string;
    lastTimePeriod?: string;
    lastResults?: string[];
  };
}

interface ParsedQuery {
  intent: string;
  timeRange: TimeRange;
  comparisonTimeRange?: TimeRange;
  parameters: Record<string, any>;
  entities: string[];
  confidence: number;
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
  late_delivery: "Late delivery",
  quality_issue: "Quality issues",
  missing_item: "Missing items",
  wrong_item: "Wrong items",
  damaged_item: "Damaged items",
  payment_issue: "Payment issues",
  other: "Other issues",
};

export class ExecutiveAssistantService {
  private tools = new CopilotTools();

  /**
   * Main query execution entry point
   */
  async query(
    question: string,
    context?: any,
    dashboardContext?: { timeFilter?: string },
  ): Promise<AssistantResponse> {
    const parsed = this.parseQuestion(question, context, dashboardContext);

    switch (parsed.intent) {
      case "NETWORK_SUMMARY":
        return this.getNetworkSummary(parsed);
      case "COMPLAINT_TRENDS":
        return this.getComplaintTrends(parsed);
      case "COMPLAINT_CATEGORIES":
        return this.getComplaintCategories(parsed);
      case "STORE_PERFORMANCE":
        return this.getStorePerformance(parsed);
      case "STORE_DETAIL":
        return this.getStoreDetail(parsed);
      case "STORE_ROOT_CAUSE":
        return this.getStoreRootCause(parsed);
      case "STORE_COMPARISON":
        return this.getStoreComparison(parsed);
      case "STORE_RECOMMENDATION":
        return this.getStoreRecommendation(parsed);
      case "CITY_PERFORMANCE":
        return this.getCityPerformance(parsed);
      case "CITY_COMPARISON":
        return this.getCityComparison(parsed);
      case "SLA_PERFORMANCE":
        return this.getSlaPerformance(parsed);
      case "AUTOMATION_PERFORMANCE":
        return this.getAutomationPerformance(parsed);
      case "RISK_SUMMARY":
        return this.getRiskSummary(parsed);
      case "ANOMALIES_ALERTS":
        return this.getAnomaliesAndAlerts(parsed);
      case "PERIOD_COMPARISON":
        return this.getPeriodComparison(parsed);
      case "GENERAL_DARKOPS_KNOWLEDGE":
        return this.getDarkOpsKnowledge(question);
      case "HELP":
        return this.getHelpResponse();
      default:
        return this.getUnsupportedResponse();
    }
  }

  /**
   * Semantic intent and entity parser
   */
  private parseQuestion(
    question: string,
    context?: any,
    dashboardContext?: { timeFilter?: string },
  ): ParsedQuery {
    const q = question.toLowerCase().trim();
    const tokens = this.tokenize(q);

    // 1. Explicit out of scope check
    if (this.isOutOfScope(q)) {
      return {
        intent: "UNSUPPORTED",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0,
      };
    }

    // 2. Knowledge queries
    if (
      q.includes("what is darkops") ||
      q.includes("how does auto-resolution work") ||
      q.includes("nlp an llm") ||
      q.includes("is this an llm") ||
      q.includes("use an llm") ||
      q.includes("pulsescore work") ||
      q.includes("what is pulsescore")
    ) {
      return {
        intent: "GENERAL_DARKOPS_KNOWLEDGE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.98,
      };
    }

    // 3. Help query
    if (
      q === "help" ||
      q === "what can you do" ||
      q === "what can you do?" ||
      q.includes("what questions can i ask") ||
      q.includes("what are your capabilities")
    ) {
      return {
        intent: "HELP",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.95,
      };
    }

    // 4. Follow-up detection using conversation context
    if (context) {
      const followUp = this.detectFollowUp(q, tokens, context, dashboardContext);
      if (followUp) return followUp;
    }

    // 5. City-to-city comparison (e.g. "compare mumbai vs delhi")
    const cityMatch = this.detectCityComparison(q);
    if (cityMatch) {
      return {
        intent: "CITY_COMPARISON",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city1: cityMatch.city1, city2: cityMatch.city2 },
        entities: [cityMatch.city1, cityMatch.city2],
        confidence: 0.95,
      };
    }

    // 6. Direct entity matches (e.g. DS-1462)
    const storeId = this.extractStoreId(q);
    if (storeId) {
      if (q.includes("why") || q.includes("struggling") || q.includes("problem") || q.includes("drop")) {
        return {
          intent: "STORE_ROOT_CAUSE",
          timeRange: this.getTimeRange(q, dashboardContext),
          parameters: { storeId },
          entities: [storeId],
          confidence: 0.95,
        };
      }
      return {
        intent: "STORE_DETAIL",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { storeId },
        entities: [storeId],
        confidence: 0.95,
      };
    }

    // 7. General Period Comparison (e.g. "compare complaints this week with last week")
    if (
      q.includes("compare") &&
      (q.includes("last week") || q.includes("last month") || q.includes("yesterday") || q.includes("previous period"))
    ) {
      const timeRange = this.getTimeRange(q, dashboardContext);
      const comparisonRange = this.getComparisonRange(q, timeRange);
      return {
        intent: "PERIOD_COMPARISON",
        timeRange,
        comparisonTimeRange: comparisonRange,
        parameters: { metric: q.includes("sla") ? "sla_breaches" : "complaints" },
        entities: [],
        confidence: 0.92,
      };
    }

    // 8. Anomalies & Alerts
    if (
      q.includes("unusual") ||
      q.includes("alert") ||
      q.includes("freezer") ||
      q.includes("equipment") ||
      q.includes("needs attention") ||
      q.includes("concerned about") ||
      q.includes("any problems")
    ) {
      return {
        intent: "ANOMALIES_ALERTS",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.9,
      };
    }

    // 9. Automation & Resolution
    if (
      q.includes("automation") ||
      q.includes("auto-resolved") ||
      q.includes("auto resolved") ||
      q.includes("auto-approved") ||
      q.includes("auto approved") ||
      q.includes("manual intervention")
    ) {
      return {
        intent: "AUTOMATION_PERFORMANCE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.92,
      };
    }

    // 10. Fraud & Risk
    if (
      q.includes("fraud") ||
      q.includes("suspicious") ||
      q.includes("risk review") ||
      q.includes("fraud risk") ||
      q.includes("risk pattern")
    ) {
      return {
        intent: "RISK_SUMMARY",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.92,
      };
    }

    // 11. SLA Performance
    if (
      q.includes("sla") ||
      q.includes("breach") ||
      q.includes("overdue") ||
      q.includes("target 95") ||
      q.includes("p1 case") ||
      q.includes("compliance")
    ) {
      const city = this.extractCity(q);
      return {
        intent: "SLA_PERFORMANCE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city },
        entities: city ? [city] : [],
        confidence: 0.9,
      };
    }

    // 12. Complaint Categories
    if (
      q.includes("category") ||
      q.includes("categories") ||
      q.includes("missing item") ||
      q.includes("late delivery") ||
      q.includes("damaged item") ||
      q.includes("quality issue") ||
      q.includes("complaining about") ||
      q.includes("type of complaint")
    ) {
      const city = this.extractCity(q);
      return {
        intent: "COMPLAINT_CATEGORIES",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city },
        entities: city ? [city] : [],
        confidence: 0.9,
      };
    }

    // 13. City Performance
    if (
      q.includes("city") ||
      q.includes("cities") ||
      q.includes("regional") ||
      q.includes("regions") ||
      q.includes("where are complaints concentrated")
    ) {
      return {
        intent: "CITY_PERFORMANCE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.9,
      };
    }

    // 14. Store Performance / Problem Stores
    if (
      q.includes("which store") ||
      q.includes("which stores") ||
      q.includes("what dark store") ||
      q.includes("what dark stores") ||
      q.includes("problem store") ||
      q.includes("struggling") ||
      q.includes("lowest pulse") ||
      q.includes("worst store") ||
      q.includes("stores have the most")
    ) {
      const city = this.extractCity(q);
      return {
        intent: "STORE_PERFORMANCE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city },
        entities: city ? [city] : [],
        confidence: 0.9,
      };
    }

    // 15. Complaint Trends
    if (
      q.includes("trend") ||
      q.includes("increasing") ||
      q.includes("rising") ||
      q.includes("going up") ||
      q.includes("what's changed") ||
      q.includes("what has changed") ||
      q.includes("spike") ||
      q.includes("backlog")
    ) {
      const city = this.extractCity(q);
      return {
        intent: "COMPLAINT_TRENDS",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city },
        entities: city ? [city] : [],
        confidence: 0.9,
      };
    }

    // 16. Network Summary / Availability
    if (
      q.includes("happening") ||
      q.includes("operational summary") ||
      q.includes("network health") ||
      q.includes("how are we doing") ||
      q.includes("availability") ||
      q.includes("uptime") ||
      q.includes("overall status") ||
      q.includes("network status") ||
      q.includes("overview") ||
      q.includes("biggest operational") ||
      q.includes("operational issue") ||
      q.includes("operational issues") ||
      q.includes("biggest issue") ||
      q.includes("biggest problem") ||
      q.includes("major issue")
    ) {
      return {
        intent: "NETWORK_SUMMARY",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.9,
      };
    }

    // Fallback: If any recognized city is in query
    const cityInQuery = this.extractCity(q);
    if (cityInQuery) {
      return {
        intent: "STORE_PERFORMANCE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city: cityInQuery },
        entities: [cityInQuery],
        confidence: 0.8,
      };
    }

    return {
      intent: "UNSUPPORTED",
      timeRange: this.getTimeRange(q, dashboardContext),
      parameters: {},
      entities: [],
      confidence: 0,
    };
  }

  /**
   * Conversational context resolver for multi-turn dialogues
   */
  private detectFollowUp(
    q: string,
    tokens: string[],
    context: any,
    dashboardContext?: { timeFilter?: string },
  ): ParsedQuery | null {
    const isFirstRef =
      q.includes("first one") ||
      q.includes("the first") ||
      q.includes("top one") ||
      q.includes("top store");
    const isSecondRef = q.includes("second one") || q.includes("the second");
    const isItRef =
      q.includes("why is it") ||
      q.includes("why it is") ||
      q.includes("compare it") ||
      q.includes("what about it") ||
      q.includes("investigate it");
    const isThereRef = q.includes("there") || q.includes("at that store");

    const targetStoreId = isSecondRef
      ? context.lastResults?.[1] || context.lastStore
      : isFirstRef
        ? context.lastResults?.[0] || context.lastStore
        : context.lastStore || context.lastResults?.[0];

    // Follow-up: "Which stores are driving that?"
    if (
      q.includes("which stores are driving") ||
      q.includes("which stores are responsible") ||
      (q.includes("which stores") &&
        (context.lastIntent === "NETWORK_SUMMARY" || context.lastIntent === "COMPLAINT_CATEGORIES"))
    ) {
      return {
        intent: "STORE_PERFORMANCE",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { city: context.lastCity },
        entities: context.lastCity ? [context.lastCity] : [],
        confidence: 0.95,
      };
    }

    // Follow-up: "Why is the first one high?" / "Why is it high?" -> Root cause analysis!
    if ((isFirstRef || isSecondRef || isItRef || isThereRef) && (q.includes("why") || q.includes("high") || q.includes("struggling"))) {
      if (targetStoreId) {
        return {
          intent: "STORE_ROOT_CAUSE",
          timeRange: this.getTimeRange(q, dashboardContext),
          parameters: { storeId: targetStoreId },
          entities: [targetStoreId],
          confidence: 0.95,
        };
      }
    }

    // Follow-up: "Compare it with last week" -> Store comparison!
    if ((isItRef || isThereRef || q.includes("compare")) && (q.includes("last week") || q.includes("yesterday") || q.includes("vs") || q.includes("last month"))) {
      if (targetStoreId) {
        const timeRange = this.getTimeRange(q, dashboardContext);
        const compRange = this.getComparisonRange(q, timeRange);
        return {
          intent: "STORE_COMPARISON",
          timeRange,
          comparisonTimeRange: compRange,
          parameters: { storeId: targetStoreId },
          entities: [targetStoreId],
          confidence: 0.95,
        };
      }
    }

    // Follow-up: "What should I investigate first?" -> Actionable recommendations!
    if (
      q.includes("investigate first") ||
      q.includes("what should i investigate") ||
      q.includes("action item") ||
      q.includes("recommendation") ||
      q.includes("what to do")
    ) {
      return {
        intent: "STORE_RECOMMENDATION",
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: { storeId: targetStoreId, city: context.lastCity },
        entities: targetStoreId ? [targetStoreId] : [],
        confidence: 0.95,
      };
    }

    // Follow-up: "What are customers complaining about there?"
    if (isThereRef || (isItRef && (q.includes("complaining") || q.includes("complaint")))) {
      if (targetStoreId) {
        return {
          intent: "COMPLAINT_CATEGORIES",
          timeRange: this.getTimeRange(q, dashboardContext),
          parameters: { storeId: targetStoreId },
          entities: [targetStoreId],
          confidence: 0.92,
        };
      }
    }

    return null;
  }

  /**
   * 1. Intent Handler: Network Summary
   */
  private async getNetworkSummary(parsed: ParsedQuery): Promise<AssistantResponse> {
    const kpis = await this.tools.getNetworkKPIs(parsed.timeRange);

    const topStoreText = kpis.topProblemStore
      ? `${kpis.topProblemStore.name} (${kpis.topProblemStore.city}) recorded the highest complaint volume (${kpis.topProblemStore.complaints} cases).`
      : "";

    const topCatText = kpis.topCategory
      ? `${CATEGORY_LABEL_MAP[kpis.topCategory.category] || kpis.topCategory.category} represents the top complaint category (${kpis.topCategory.count} cases).`
      : "";

    const answer = `Network overview for ${parsed.timeRange.label}: We are tracking ${kpis.totalComplaints} total issues across ${kpis.storeCount} dark stores in ${kpis.cityCount} cities. Currently, ${kpis.activeCases} cases are in the active support queue and ${kpis.slaBreached} cases have breached SLA. Average network PulseScore is ${kpis.avgPulse}/100, with ${kpis.criticalStores} stores in critical health (<60). ${topCatText} ${topStoreText} ${kpis.pendingFraud} cases are currently flagged for fraud review.`;

    const topStoreId = kpis.topProblemStore?.id || "DS-1462";
    const topCity = kpis.topProblemStore?.city || "Kolkata";

    return {
      intent: "NETWORK_SUMMARY",
      answer,
      summary: `Network summary: ${kpis.totalComplaints} complaints, ${kpis.activeCases} active, ${kpis.slaBreached} breached, ${kpis.criticalStores} critical stores.`,
      metrics: [
        { label: "Active cases", value: `${kpis.activeCases}`, tone: kpis.activeCases > 50 ? "warn" : "ok" },
        { label: "SLA breached", value: `${kpis.slaBreached}`, tone: kpis.slaBreached > 0 ? "crit" : "ok" },
        { label: "Network Pulse", value: `${kpis.avgPulse}/100`, tone: kpis.avgPulse < 60 ? "crit" : kpis.avgPulse < 80 ? "warn" : "ok" },
        { label: "Critical stores", value: `${kpis.criticalStores}`, tone: kpis.criticalStores > 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Total issues", value: `${kpis.totalComplaints}` },
        { label: "Active support cases", value: `${kpis.activeCases}` },
        { label: "SLA breaches", value: `${kpis.slaBreached}` },
        { label: "Top category", value: kpis.topCategory ? CATEGORY_LABEL_MAP[kpis.topCategory.category] || kpis.topCategory.category : "N/A" },
      ],
      suggestedQuestions: [
        "Which stores have the most complaints?",
        "What are the top complaint categories?",
        "Are complaints increasing?",
        "How effective is automation?",
      ],
      drillDown: {
        label: "Open Operations Board",
        route: "/operations",
      },
      context: {
        lastIntent: "NETWORK_SUMMARY",
        lastStore: topStoreId,
        lastCity: topCity,
        lastTimePeriod: parsed.timeRange.label,
        lastResults: [topStoreId],
      },
    };
  }

  /**
   * 2. Intent Handler: Complaint Trends
   */
  private async getComplaintTrends(parsed: ParsedQuery): Promise<AssistantResponse> {
    const currentRange = parsed.timeRange;
    const priorRange = parsed.comparisonTimeRange || this.getPriorPeriod(currentRange);

    const [curAnalytics, priorAnalytics] = await Promise.all([
      this.tools.getComplaintAnalytics(currentRange, parsed.parameters),
      this.tools.getComplaintAnalytics(priorRange, parsed.parameters),
    ]);

    const deltaPct = this.tools.calcPctChange(curAnalytics.total, priorAnalytics.total);
    const direction = deltaPct > 0 ? "increased" : deltaPct < 0 ? "decreased" : "remained steady";
    const deltaSign = deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`;

    const answer = `Complaint trend analysis (${currentRange.label} vs ${priorRange.label}): Total complaints have ${direction} by ${Math.abs(deltaPct)}% (${curAnalytics.total} cases vs ${priorAnalytics.total} in previous period). Active unresolved cases currently stand at ${curAnalytics.total - curAnalytics.resolvedCount}. SLA breach rate is ${curAnalytics.slaBreachRate}% (${curAnalytics.slaBreachedCount} breached cases).`;

    return {
      intent: "COMPLAINT_TRENDS",
      answer,
      summary: `Complaints ${direction} by ${Math.abs(deltaPct)}% (${curAnalytics.total} vs ${priorAnalytics.total}).`,
      metrics: [
        { label: "Current volume", value: `${curAnalytics.total}`, tone: "neutral" },
        { label: "Prior volume", value: `${priorAnalytics.total}`, tone: "neutral" },
        { label: "Period delta", value: deltaSign, tone: deltaPct > 0 ? "crit" : "ok" },
        { label: "SLA breach rate", value: `${curAnalytics.slaBreachRate}%`, tone: curAnalytics.slaBreachRate > 20 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Current period", value: `${curAnalytics.total} cases (${currentRange.label})` },
        { label: "Previous period", value: `${priorAnalytics.total} cases (${priorRange.label})` },
        { label: "Delta percentage", value: deltaSign },
      ],
      suggestedQuestions: [
        "What are the top complaint categories?",
        "Which stores are driving that?",
        "Where are SLA breaches happening?",
      ],
      drillDown: {
        label: "View 30-Day Volume Chart",
        route: "/executive",
      },
      context: {
        lastIntent: "COMPLAINT_TRENDS",
        lastTimePeriod: currentRange.label,
      },
    };
  }

  /**
   * 3. Intent Handler: Complaint Categories
   */
  private async getComplaintCategories(parsed: ParsedQuery): Promise<AssistantResponse> {
    const analytics = await this.tools.getComplaintAnalytics(parsed.timeRange, parsed.parameters);

    const topCategoriesText = analytics.byCategory
      .slice(0, 4)
      .map((c) => `${CATEGORY_LABEL_MAP[c.category] || c.category}: ${c.count} cases (${c.percentage}%)`)
      .join("; ");

    const topCat = analytics.byCategory[0];
    const topCatLabel = topCat ? CATEGORY_LABEL_MAP[topCat.category] || topCat.category : "None";

    const filterText = parsed.parameters.storeId
      ? ` for store ${parsed.parameters.storeId}`
      : parsed.parameters.city
        ? ` in ${parsed.parameters.city}`
        : "";

    const answer = `Complaint breakdown${filterText} for ${parsed.timeRange.label}: ${topCategoriesText}. ${topCatLabel} represents the primary operational driver with ${topCat?.count || 0} occurrences (${topCat?.percentage || 0}% of all logged issues).`;

    return {
      intent: "COMPLAINT_CATEGORIES",
      answer,
      summary: `Top category: ${topCatLabel} (${topCat?.count || 0} cases, ${topCat?.percentage || 0}%).`,
      metrics: analytics.byCategory.slice(0, 4).map((c) => ({
        label: CATEGORY_LABEL_MAP[c.category] || c.category,
        value: `${c.count} (${c.percentage}%)`,
        tone: c.percentage > 30 ? "warn" : "neutral",
      })),
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Total analyzed", value: `${analytics.total} cases` },
        { label: "Top category", value: `${topCatLabel} (${topCat?.count || 0})` },
      ],
      suggestedQuestions: [
        "Which stores are driving that?",
        "How effective is automation?",
        "What is the network PulseScore?",
      ],
      drillDown: {
        label: "View Operations Queue",
        route: "/operations",
      },
      context: {
        lastIntent: "COMPLAINT_CATEGORIES",
        lastCategory: topCat?.category,
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 4. Intent Handler: Store Performance / Problem Stores
   */
  private async getStorePerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const stores = await this.tools.getStoreRankings("complaints", 5, parsed.parameters);

    const cityText = parsed.parameters.city ? ` in ${parsed.parameters.city}` : "";
    const listText = stores
      .map(
        (s) =>
          `${s.id} (${s.name}) — ${s.openComplaints} complaints, Pulse ${s.pulse}/100, ${s.slaBreaches} SLA breaches`,
      )
      .join("; ");

    const worstStore = stores[0];
    const answer = `Top problem stores by complaint volume${cityText} for ${parsed.timeRange.label}: ${listText}. ${worstStore ? `${worstStore.name} (${worstStore.id}) has the highest issue volume (${worstStore.openComplaints} complaints)` : "No stores found"}.`;

    return {
      intent: "STORE_PERFORMANCE",
      answer,
      summary: `Top problem store: ${worstStore?.name || "None"} (${worstStore?.openComplaints || 0} complaints, Pulse ${worstStore?.pulse || 70}).`,
      metrics: stores.slice(0, 4).map((s) => ({
        label: s.name.replace(/ DS$/, ""),
        value: `${s.openComplaints} complaints (Pulse ${s.pulse})`,
        tone: s.pulse < 60 ? "crit" : s.pulse < 80 ? "warn" : "ok",
      })),
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Locations analyzed", value: `${stores.length}` },
        { label: "Top problem store", value: `${worstStore?.id} (${worstStore?.name})` },
      ],
      suggestedQuestions: [
        `Why is ${worstStore?.id || "the first one"} struggling?`,
        `What are customers complaining about there?`,
        `Compare ${worstStore?.id || "it"} with last week`,
      ],
      drillDown: worstStore
        ? {
            label: `Open ${worstStore.name} Dashboard`,
            route: `/dark-stores/${worstStore.id}`,
          }
        : undefined,
      context: {
        lastIntent: "STORE_PERFORMANCE",
        lastStore: worstStore?.id,
        lastCity: worstStore?.city,
        lastResults: stores.map((s) => s.id),
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 5. Intent Handler: Store Root Cause (Why is it high?)
   */
  private async getStoreRootCause(parsed: ParsedQuery): Promise<AssistantResponse> {
    const storeId = parsed.parameters.storeId || "DS-1462";
    const priorRange = this.getPriorPeriod(parsed.timeRange);
    const detail = await this.tools.getStoreDetail(storeId, parsed.timeRange, priorRange);

    if (!detail) {
      return this.getStoreNotFoundResponse(storeId);
    }

    const catText = detail.topCategories
      .map((c) => `${CATEGORY_LABEL_MAP[c.category] || c.category} (${c.count} cases)`)
      .join(", ");

    const workOrderText = detail.workOrders.length
      ? `Active equipment work orders: ${detail.workOrders.map((w) => `${w.asset} (${w.priority})`).join(", ")}.`
      : "No active equipment breakdowns recorded.";

    const alertText = detail.activeAlerts.length
      ? `Active critical alerts: ${detail.activeAlerts.map((a) => a.title).join("; ")}.`
      : "";

    const deltaSign = (detail.complaintsDeltaPct || 0) >= 0 ? `+${detail.complaintsDeltaPct}%` : `${detail.complaintsDeltaPct}%`;

    const answer = `Root cause analysis for ${detail.id} (${detail.name}, ${detail.city}): Complaints have reached ${detail.complaintsCount} cases for ${parsed.timeRange.label} (${deltaSign} vs prior period). The primary driver is ${catText || "unspecified complaints"}. SLA breaches stand at ${detail.slaBreaches}. ${workOrderText} ${alertText} PulseScore is currently ${detail.currentPulse}/100 (${detail.pulseTrend >= 0 ? `+${detail.pulseTrend}` : detail.pulseTrend} points this week).`;

    return {
      intent: "STORE_ROOT_CAUSE",
      answer,
      summary: `Root cause for ${detail.id}: driven by ${detail.topCategories[0] ? CATEGORY_LABEL_MAP[detail.topCategories[0].category] : "complaints"}, ${detail.slaBreaches} SLA breaches, and ${detail.workOrders.length} work orders.`,
      metrics: [
        { label: "PulseScore", value: `${detail.currentPulse}/100`, tone: detail.currentPulse < 60 ? "crit" : "warn" },
        { label: "Total complaints", value: `${detail.complaintsCount}`, tone: "crit" },
        { label: "SLA breaches", value: `${detail.slaBreaches}`, tone: detail.slaBreaches > 0 ? "crit" : "ok" },
        { label: "Open work orders", value: `${detail.workOrders.length}`, tone: detail.workOrders.length > 0 ? "warn" : "ok" },
      ],
      evidence: [
        { label: "Store", value: `${detail.id} (${detail.name})` },
        { label: "Dominant issue", value: detail.topCategories[0] ? CATEGORY_LABEL_MAP[detail.topCategories[0].category] : "N/A" },
        { label: "SLA breaches", value: `${detail.slaBreaches}` },
        { label: "Equipment faults", value: `${detail.workOrders.length}` },
      ],
      suggestedQuestions: [
        `Compare ${detail.id} with last week`,
        `What should I investigate first?`,
        `What are customers complaining about there?`,
      ],
      drillDown: {
        label: `View ${detail.id} Store Detail`,
        route: `/dark-stores/${detail.id}`,
      },
      context: {
        lastIntent: "STORE_ROOT_CAUSE",
        lastStore: detail.id,
        lastCity: detail.city,
        lastResults: [detail.id],
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 6. Intent Handler: Store Period Comparison (Compare it with last week)
   */
  private async getStoreComparison(parsed: ParsedQuery): Promise<AssistantResponse> {
    const storeId = parsed.parameters.storeId || "DS-1462";
    const currentRange = parsed.timeRange;
    const priorRange = parsed.comparisonTimeRange || this.getPriorPeriod(currentRange);

    const [curDetail, priorDetail] = await Promise.all([
      this.tools.getStoreDetail(storeId, currentRange),
      this.tools.getStoreDetail(storeId, priorRange),
    ]);

    if (!curDetail) return this.getStoreNotFoundResponse(storeId);

    const curCount = curDetail.complaintsCount;
    const priorCount = priorDetail?.complaintsCount || 0;
    const diff = curCount - priorCount;
    const pctChange = this.tools.calcPctChange(curCount, priorCount);
    const sign = diff >= 0 ? `+${diff}` : `${diff}`;
    const pctSign = pctChange >= 0 ? `+${pctChange}%` : `${pctChange}%`;

    const pulseDiff = curDetail.currentPulse - (priorDetail?.currentPulse || curDetail.currentPulse);
    const pulseSign = pulseDiff >= 0 ? `+${pulseDiff}` : `${pulseDiff}`;

    const answer = `Comparative performance for ${curDetail.id} (${curDetail.name}) — ${currentRange.label} vs ${priorRange.label}: Complaint volume changed by ${pctSign} (${curCount} cases vs ${priorCount} cases, delta of ${sign}). Store PulseScore changed by ${pulseSign} points (currently ${curDetail.currentPulse}/100 vs ${priorDetail?.currentPulse || curDetail.currentPulse}/100). SLA breaches changed from ${priorDetail?.slaBreaches || 0} to ${curDetail.slaBreaches}.`;

    return {
      intent: "STORE_COMPARISON",
      answer,
      summary: `Comparison for ${curDetail.id}: complaints ${pctSign} (${curCount} vs ${priorCount}), PulseScore ${pulseSign} pts.`,
      metrics: [
        { label: "Current complaints", value: `${curCount}`, tone: "neutral" },
        { label: "Prior complaints", value: `${priorCount}`, tone: "neutral" },
        { label: "Volume delta", value: pctSign, tone: pctChange > 0 ? "crit" : "ok" },
        { label: "PulseScore delta", value: `${pulseSign} pts`, tone: pulseDiff < 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Current window", value: `${curCount} complaints (${currentRange.label})` },
        { label: "Prior window", value: `${priorCount} complaints (${priorRange.label})` },
        { label: "SLA breaches", value: `${curDetail.slaBreaches} current vs ${priorDetail?.slaBreaches || 0} prior` },
      ],
      suggestedQuestions: [
        `What should I investigate first?`,
        `Why is ${curDetail.id} struggling?`,
        `Which other stores need attention?`,
      ],
      drillDown: {
        label: `View ${curDetail.id} Pulse History`,
        route: `/dark-stores/${curDetail.id}/pulse`,
      },
      context: {
        lastIntent: "STORE_COMPARISON",
        lastStore: curDetail.id,
        lastCity: curDetail.city,
        lastResults: [curDetail.id],
        lastTimePeriod: currentRange.label,
      },
    };
  }

  /**
   * 7. Intent Handler: Store Actionable Recommendations (What should I investigate first?)
   */
  private async getStoreRecommendation(parsed: ParsedQuery): Promise<AssistantResponse> {
    const storeId = parsed.parameters.storeId || "DS-1462";
    const detail = await this.tools.getStoreDetail(storeId, parsed.timeRange);

    if (!detail) return this.getStoreNotFoundResponse(storeId);

    const steps: string[] = [];
    if (detail.slaBreaches > 0) {
      steps.push(`1. Triage the ${detail.slaBreaches} SLA-breached tickets in Operations Queue immediately`);
    }
    if (detail.workOrders.length > 0) {
      steps.push(`2. Dispatch maintenance technician for active work order (${detail.workOrders[0].asset})`);
    }
    if (detail.topCategories.length > 0) {
      steps.push(`3. Audit fulfillment picking bins to mitigate ${CATEGORY_LABEL_MAP[detail.topCategories[0].category] || detail.topCategories[0].category}`);
    }
    steps.push(`4. Review shift allocation (${detail.pickers} pickers, ${detail.riders} riders assigned)`);

    const answer = `Prioritized action plan for ${detail.id} (${detail.name}, ${detail.city}):\n${steps.join("\n")}\n\nExecuting these steps will stabilize the store's PulseScore from its current critical level (${detail.currentPulse}/100) and clear the ${detail.slaBreaches} overdue SLA cases.`;

    return {
      intent: "STORE_RECOMMENDATION",
      answer,
      summary: `Recommended actions for ${detail.id}: clear ${detail.slaBreaches} SLA breaches, fix ${detail.workOrders.length} equipment assets, audit ${detail.topCategories[0] ? CATEGORY_LABEL_MAP[detail.topCategories[0].category] : "picking"}.`,
      metrics: [
        { label: "Immediate SLA actions", value: `${detail.slaBreaches} tickets`, tone: "crit" },
        { label: "Equipment repairs", value: `${detail.workOrders.length} orders`, tone: "warn" },
        { label: "Current PulseScore", value: `${detail.currentPulse}/100`, tone: "crit" },
      ],
      evidence: [
        { label: "Store", value: `${detail.id} (${detail.name})` },
        { label: "Breached SLA cases", value: `${detail.slaBreaches}` },
        { label: "Work orders pending", value: `${detail.workOrders.length}` },
      ],
      suggestedQuestions: [
        `Why is ${detail.id} struggling?`,
        `Compare ${detail.id} with last week`,
        `Which other stores need attention?`,
      ],
      drillDown: {
        label: `Go to Operations Queue for ${detail.id}`,
        route: "/operations",
      },
      context: {
        lastIntent: "STORE_RECOMMENDATION",
        lastStore: detail.id,
        lastCity: detail.city,
        lastResults: [detail.id],
      },
    };
  }

  /**
   * 8. Intent Handler: Store Detail
   */
  private async getStoreDetail(parsed: ParsedQuery): Promise<AssistantResponse> {
    const storeId = parsed.parameters.storeId || "DS-1462";
    const detail = await this.tools.getStoreDetail(storeId, parsed.timeRange);

    if (!detail) return this.getStoreNotFoundResponse(storeId);

    const catText = detail.topCategories
      .map((c) => `${CATEGORY_LABEL_MAP[c.category] || c.category} (${c.count})`)
      .join(", ");

    const answer = `${detail.id} (${detail.name}, ${detail.city}): PulseScore is currently ${detail.currentPulse}/100 (${detail.pulseTrend >= 0 ? `+${detail.pulseTrend}` : detail.pulseTrend} pts). The store has ${detail.complaintsCount} complaints for ${parsed.timeRange.label} with ${detail.slaBreaches} SLA breaches. Dominant categories: ${catText || "N/A"}. On shift: ${detail.pickers} pickers, ${detail.riders} riders. Active work orders: ${detail.workOrders.length}.`;

    return {
      intent: "STORE_DETAIL",
      answer,
      summary: `${detail.id} overview: Pulse ${detail.currentPulse}/100, ${detail.complaintsCount} complaints, ${detail.slaBreaches} SLA breaches.`,
      metrics: [
        { label: "PulseScore", value: `${detail.currentPulse}/100`, tone: detail.currentPulse < 60 ? "crit" : detail.currentPulse < 80 ? "warn" : "ok" },
        { label: "Complaints", value: `${detail.complaintsCount}`, tone: "neutral" },
        { label: "SLA Breaches", value: `${detail.slaBreaches}`, tone: detail.slaBreaches > 0 ? "crit" : "ok" },
        { label: "Pickers / Riders", value: `${detail.pickers} / ${detail.riders}`, tone: "neutral" },
      ],
      evidence: [
        { label: "Store", value: `${detail.id} — ${detail.name}` },
        { label: "Manager", value: detail.managerName },
        { label: "Zone", value: detail.zone },
        { label: "Time period", value: parsed.timeRange.label },
      ],
      suggestedQuestions: [
        `Why is ${detail.id} struggling?`,
        `Compare ${detail.id} with last week`,
        `What should I investigate first?`,
      ],
      drillDown: {
        label: `Open ${detail.name} Dashboard`,
        route: `/dark-stores/${detail.id}`,
      },
      context: {
        lastIntent: "STORE_DETAIL",
        lastStore: detail.id,
        lastCity: detail.city,
        lastResults: [detail.id],
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 9. Intent Handler: City Performance
   */
  private async getCityPerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const cities = await this.tools.getCityAnalytics(parsed.timeRange);

    const topCitiesText = cities
      .slice(0, 4)
      .map(
        (c) =>
          `${c.city} (${c.complaintsCount} complaints, avg Pulse ${c.avgPulse}/100, ${c.slaBreaches} SLA breaches)`,
      )
      .join("; ");

    const topCity = cities[0];
    const answer = `City-wise operational summary for ${parsed.timeRange.label}: ${topCitiesText}. ${topCity ? `${topCity.city} has the highest complaint concentration (${topCity.complaintsCount} cases across ${topCity.storeCount} stores)` : ""}.`;

    return {
      intent: "CITY_PERFORMANCE",
      answer,
      summary: `Top city by complaints: ${topCity?.city || "N/A"} (${topCity?.complaintsCount || 0} complaints, ${topCity?.slaBreaches || 0} breaches).`,
      metrics: cities.slice(0, 4).map((c) => ({
        label: c.city,
        value: `${c.complaintsCount} cases (${c.avgPulse} pulse)`,
        tone: c.avgPulse < 60 ? "crit" : c.avgPulse < 80 ? "warn" : "ok",
      })),
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Cities analyzed", value: `${cities.length}` },
        { label: "Top city complaints", value: `${topCity?.complaintsCount || 0}` },
      ],
      suggestedQuestions: [
        `Which stores are driving complaints in ${topCity?.city || "Kolkata"}?`,
        "Where are SLA breaches happening?",
        "Compare Mumbai vs Delhi",
      ],
      drillDown: {
        label: "View City Heatmap",
        route: "/executive",
      },
      context: {
        lastIntent: "CITY_PERFORMANCE",
        lastCity: topCity?.city,
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 10. Intent Handler: City Comparison (e.g. Mumbai vs Delhi)
   */
  private async getCityComparison(parsed: ParsedQuery): Promise<AssistantResponse> {
    const city1Name = parsed.parameters.city1 || "Mumbai";
    const city2Name = parsed.parameters.city2 || "Delhi";

    const allCities = await this.tools.getCityAnalytics(parsed.timeRange);
    const c1 = allCities.find((c) => c.city.toLowerCase() === city1Name.toLowerCase()) || {
      city: city1Name,
      complaintsCount: 0,
      avgPulse: 70,
      slaBreaches: 0,
      storeCount: 0,
    };
    const c2 = allCities.find((c) => c.city.toLowerCase() === city2Name.toLowerCase()) || {
      city: city2Name,
      complaintsCount: 0,
      avgPulse: 70,
      slaBreaches: 0,
      storeCount: 0,
    };

    const diffComplaints = c1.complaintsCount - c2.complaintsCount;
    const diffPulse = c1.avgPulse - c2.avgPulse;

    const answer = `City comparison (${c1.city} vs ${c2.city}) for ${parsed.timeRange.label}:\n• Complaints: ${c1.city} has ${c1.complaintsCount} cases across ${c1.storeCount} stores vs ${c2.city}'s ${c2.complaintsCount} cases across ${c2.storeCount} stores (${diffComplaints >= 0 ? `+${diffComplaints}` : diffComplaints} delta).\n• Health: ${c1.city} averages Pulse ${c1.avgPulse}/100 vs ${c2.city}'s ${c2.avgPulse}/100 (${diffPulse >= 0 ? `+${diffPulse}` : diffPulse} pts).\n• SLA Breaches: ${c1.city} has ${c1.slaBreaches} breaches vs ${c2.city}'s ${c2.slaBreaches} breaches.`;

    return {
      intent: "CITY_COMPARISON",
      answer,
      summary: `Comparison: ${c1.city} (${c1.complaintsCount} cases, Pulse ${c1.avgPulse}) vs ${c2.city} (${c2.complaintsCount} cases, Pulse ${c2.avgPulse}).`,
      metrics: [
        { label: `${c1.city} complaints`, value: `${c1.complaintsCount}`, tone: "neutral" },
        { label: `${c2.city} complaints`, value: `${c2.complaintsCount}`, tone: "neutral" },
        { label: `${c1.city} Pulse`, value: `${c1.avgPulse}/100`, tone: c1.avgPulse < 70 ? "warn" : "ok" },
        { label: `${c2.city} Pulse`, value: `${c2.avgPulse}/100`, tone: c2.avgPulse < 70 ? "warn" : "ok" },
      ],
      evidence: [
        { label: `${c1.city} stores`, value: `${c1.storeCount}` },
        { label: `${c2.city} stores`, value: `${c2.storeCount}` },
        { label: "Time window", value: parsed.timeRange.label },
      ],
      suggestedQuestions: [
        `Which stores are driving complaints in ${c1.complaintsCount >= c2.complaintsCount ? c1.city : c2.city}?`,
        "Where are SLA breaches happening?",
        "What are the biggest operational issues right now?",
      ],
      drillDown: {
        label: "View Executive Dashboard",
        route: "/executive",
      },
      context: {
        lastIntent: "CITY_COMPARISON",
        lastCity: c1.complaintsCount >= c2.complaintsCount ? c1.city : c2.city,
      },
    };
  }

  /**
   * 11. Intent Handler: SLA Performance
   */
  private async getSlaPerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const sla = await this.tools.getSLAAnalytics(parsed.timeRange, parsed.parameters);

    const cityText = sla.byCity.length
      ? `Concentrated in: ${sla.byCity.slice(0, 3).map((c) => `${c.city} (${c.breaches})`).join(", ")}.`
      : "No city-level clusters.";

    const answer = `SLA performance for ${parsed.timeRange.label}: Out of ${sla.activeTotal} active cases, ${sla.breached} cases (${sla.breachRate}%) have breached resolution SLA, and ${sla.atRisk} cases are currently at risk. Critical P1 breaches: ${sla.p1Breaches}, P2 breaches: ${sla.p2Breaches}. ${cityText}`;

    return {
      intent: "SLA_PERFORMANCE",
      answer,
      summary: `SLA status: ${sla.breached} breached cases (${sla.breachRate}% breach rate), ${sla.atRisk} at-risk cases.`,
      metrics: [
        { label: "Active support queue", value: `${sla.activeTotal}`, tone: "neutral" },
        { label: "SLA breached cases", value: `${sla.breached}`, tone: sla.breached > 0 ? "crit" : "ok" },
        { label: "SLA breach rate", value: `${sla.breachRate}%`, tone: sla.breachRate > 20 ? "crit" : "ok" },
        { label: "P1 critical breaches", value: `${sla.p1Breaches}`, tone: sla.p1Breaches > 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Active queue", value: `${sla.activeTotal}` },
        { label: "SLA breaches", value: `${sla.breached}` },
        { label: "Breach percentage", value: `${sla.breachRate}%` },
        { label: "P1 / P2 breaches", value: `${sla.p1Breaches} / ${sla.p2Breaches}` },
      ],
      suggestedQuestions: [
        "Which stores have the most complaints?",
        "Are complaints increasing?",
        "What should I investigate first?",
      ],
      drillDown: {
        label: "Open Operations Queue",
        route: "/operations",
      },
      context: {
        lastIntent: "SLA_PERFORMANCE",
        lastCity: sla.byCity[0]?.city,
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 12. Intent Handler: Automation Performance
   */
  private async getAutomationPerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const auto = await this.tools.getAutomationMetrics(parsed.timeRange);

    const refundInRupees = Math.round(auto.autoApprovedRefundsPaise / 100);
    const answer = `Automation performance for ${parsed.timeRange.label}: Out of ${auto.totalComplaints} processed issues, ${auto.autoResolvedCount} cases (${auto.autoResolutionRate}%) were auto-resolved without agent intervention (totaling ₹${refundInRupees} in auto-approved refunds). ${auto.manualQueueCount} cases are routed to the manual support queue.`;

    return {
      intent: "AUTOMATION_PERFORMANCE",
      answer,
      summary: `Automation: ${auto.autoResolutionRate}% auto-resolution rate (${auto.autoResolvedCount} auto-resolved, ${auto.manualQueueCount} manual).`,
      metrics: [
        { label: "Total issues processed", value: `${auto.totalComplaints}`, tone: "neutral" },
        { label: "Auto-resolved cases", value: `${auto.autoResolvedCount}`, tone: "ok" },
        { label: "Manual support queue", value: `${auto.manualQueueCount}`, tone: "warn" },
        { label: "Auto-resolution rate", value: `${auto.autoResolutionRate}%`, tone: auto.autoResolutionRate > 30 ? "ok" : "warn" },
      ],
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Total processed", value: `${auto.totalComplaints}` },
        { label: "Auto-resolved", value: `${auto.autoResolvedCount}` },
        { label: "Manual queue", value: `${auto.manualQueueCount}` },
      ],
      suggestedQuestions: [
        "How does auto-resolution work?",
        "What are the top complaint categories?",
        "Where are SLA breaches happening?",
      ],
      drillDown: {
        label: "View Automation Settings",
        route: "/settings",
      },
      context: {
        lastIntent: "AUTOMATION_PERFORMANCE",
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * 13. Intent Handler: Risk & Fraud
   */
  private async getRiskSummary(parsed: ParsedQuery): Promise<AssistantResponse> {
    const risk = await this.tools.getRiskAnalytics();

    const storesText = risk.affectedStores
      .slice(0, 3)
      .map((s) => `${s.id} (${s.name})`)
      .join(", ");

    const answer = `Risk & fraud overview: ${risk.pendingCount} cases are currently flagged for fraud review across ${risk.affectedStores.length} dark stores. Flagged cases are concentrated in: ${storesText || "none"}.`;

    return {
      intent: "RISK_SUMMARY",
      answer,
      summary: `Fraud review: ${risk.pendingCount} pending cases across ${risk.affectedStores.length} stores.`,
      metrics: [
        { label: "Pending risk reviews", value: `${risk.pendingCount}`, tone: risk.pendingCount > 0 ? "warn" : "ok" },
        { label: "Affected stores", value: `${risk.affectedStores.length}`, tone: "neutral" },
      ],
      evidence: [
        { label: "Flagged review cases", value: `${risk.pendingCount}` },
        { label: "Affected stores", value: `${risk.affectedStores.length}` },
      ],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "Where are SLA breaches happening?",
      ],
      drillDown: {
        label: "Open Fraud Review Board",
        route: "/fraud",
      },
      context: {
        lastIntent: "RISK_SUMMARY",
        lastStore: risk.affectedStores[0]?.id,
        lastCity: risk.affectedStores[0]?.city,
      },
    };
  }

  /**
   * 14. Intent Handler: Anomalies & Alerts
   */
  private async getAnomaliesAndAlerts(parsed: ParsedQuery): Promise<AssistantResponse> {
    const anomalies = await this.tools.getAnomaliesAndAlerts();

    const critAlerts = anomalies.filter((a) => a.type === "critical_alert");
    const pulseDrops = anomalies.filter((a) => a.type === "pulse_drop");

    const descList = anomalies.slice(0, 4).map((a) => `• ${a.title}: ${a.description}`).join("\n");

    const answer = `Operational anomalies and alerts summary:\n${descList || "No critical hardware anomalies detected."}\n\nImmediate recommendation: dispatch maintenance teams to resolve active freezer and equipment failures to prevent inventory spoilage.`;

    return {
      intent: "ANOMALIES_ALERTS",
      answer,
      summary: `${critAlerts.length} critical alerts, ${pulseDrops.length} stores with severe PulseScore drops.`,
      metrics: [
        { label: "Active critical alerts", value: `${critAlerts.length}`, tone: critAlerts.length > 0 ? "crit" : "ok" },
        { label: "Critical health stores", value: `${pulseDrops.length}`, tone: pulseDrops.length > 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Critical alerts", value: `${critAlerts.length}` },
        { label: "Severe pulse drops", value: `${pulseDrops.length}` },
      ],
      suggestedQuestions: [
        "What should I investigate first?",
        "Which stores have the most complaints?",
        "What is happening across the network?",
      ],
      drillDown: {
        label: "View Network Red Alerts",
        route: "/executive",
      },
      context: {
        lastIntent: "ANOMALIES_ALERTS",
        lastStore: anomalies[0]?.entityId,
      },
    };
  }

  /**
   * 15. Intent Handler: General Period Comparison
   */
  private async getPeriodComparison(parsed: ParsedQuery): Promise<AssistantResponse> {
    const currentRange = parsed.timeRange;
    const priorRange = parsed.comparisonTimeRange || this.getPriorPeriod(currentRange);

    const comp = await this.tools.comparePeriods(
      parsed.parameters.metric || "complaints",
      currentRange,
      priorRange,
    );

    const direction = comp.difference > 0 ? "increased" : comp.difference < 0 ? "decreased" : "remained unchanged";
    const deltaSign = comp.percentageChange >= 0 ? `+${comp.percentageChange}%` : `${comp.percentageChange}%`;

    const answer = `Period comparison (${comp.currentPeriodLabel} vs ${comp.previousPeriodLabel}): ${comp.metric} ${direction} by ${Math.abs(comp.percentageChange)}% (${comp.currentValue} vs ${comp.previousValue}, difference of ${comp.difference >= 0 ? `+${comp.difference}` : comp.difference}).`;

    return {
      intent: "PERIOD_COMPARISON",
      answer,
      summary: `${comp.metric} ${direction} by ${Math.abs(comp.percentageChange)}% (${comp.currentValue} vs ${comp.previousValue}).`,
      metrics: [
        { label: `Current (${comp.currentPeriodLabel})`, value: `${comp.currentValue}`, tone: "neutral" },
        { label: `Prior (${comp.previousPeriodLabel})`, value: `${comp.previousValue}`, tone: "neutral" },
        { label: "Percentage change", value: deltaSign, tone: comp.percentageChange > 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Metric", value: comp.metric },
        { label: "Current period", value: comp.currentPeriodLabel },
        { label: "Prior period", value: comp.previousPeriodLabel },
      ],
      suggestedQuestions: [
        "Which stores are driving that?",
        "What are the top complaint categories?",
        "Where are SLA breaches happening?",
      ],
      drillDown: {
        label: "View Executive Overview",
        route: "/executive",
      },
      context: {
        lastIntent: "PERIOD_COMPARISON",
      },
    };
  }

  /**
   * 16. Intent Handler: DarkOps Knowledge FAQ
   */
  private getDarkOpsKnowledge(question: string): AssistantResponse {
    const q = question.toLowerCase();

    let answer = "";
    if (q.includes("what is darkops")) {
      answer =
        "DarkOps is an operational intelligence and exception management platform for quick-commerce dark store operations. It monitors network health, manages complaints, automates resolution, and provides real-time analytics for decision-making.";
    } else if (q.includes("how does auto-resolution work") || q.includes("auto resolution")) {
      answer =
        "Auto-resolution uses deterministic NLP classification to identify simple refund-eligible cases (like missing items) and automatically routes them for processing without manual agent intervention.";
    } else if (q.includes("pulsescore")) {
      answer =
        "PulseScore is a composite operational health index (12–100) computed from penalty deductions: equipment failures (up to 25 pts), SLA breaches (up to 25 pts), refund rates (up to 20 pts), delivery delays (up to 15 pts), picker delays (up to 10 pts), and inventory discrepancies (up to 5 pts).";
    } else if (q.includes("llm") || q.includes("nlp")) {
      answer =
        "DarkOps uses a deterministic NLP classification engine backed by weighted scoring, exact entity extraction, and database analytics. It does NOT use external LLMs or unexplainable generative AI models.";
    } else {
      answer =
        "DarkOps is an operational intelligence layer connecting customer support, dark store operations, and executive leadership.";
    }

    return {
      intent: "GENERAL_DARKOPS_KNOWLEDGE",
      answer,
      summary: answer.slice(0, 100) + "...",
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "How effective is automation?",
      ],
    };
  }

  /**
   * 17. Help Response
   */
  private getHelpResponse(): AssistantResponse {
    return {
      intent: "HELP",
      answer:
        "I am the DarkOps Executive Operational Copilot. I analyze live database metrics to answer operational intelligence questions across these capabilities:\n• Network health & PulseScores\n• Complaint volumes & category breakdowns\n• Problem stores & store deep-dives\n• City-level performance & comparisons\n• SLA compliance & breach tracking\n• Automation & auto-resolution rates\n• Fraud & risk reviews\n• Hardware anomalies & red alerts",
      summary: "Executive Operational Copilot capabilities guide.",
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "Are complaints increasing?",
        "Where are SLA breaches happening?",
      ],
    };
  }

  /**
   * 18. Unsupported / Out-of-scope response
   */
  private getUnsupportedResponse(): AssistantResponse {
    return {
      intent: "UNSUPPORTED",
      answer:
        "I can help with DarkOps operational intelligence, including network trends, complaints, stores, SLA performance, automation and risk.",
      summary: "Out of scope query.",
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "Are complaints increasing?",
        "How effective is automation?",
      ],
    };
  }

  private getStoreNotFoundResponse(storeId: string): AssistantResponse {
    return {
      intent: "STORE_DETAIL",
      answer: `I could not find record for store ${storeId} in the operational database. Please check the Store ID.`,
      summary: `Store ${storeId} not found.`,
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "Which stores have the most complaints?",
        "What is happening across the network?",
      ],
    };
  }

  // --- Helper Methods ---

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private isOutOfScope(q: string): boolean {
    const terms = [
      "weather",
      "cricket",
      "recipe",
      "write an email",
      "tell a joke",
      "who won",
      "football",
      "movie",
      "song",
      "translate",
    ];
    return terms.some((t) => q.includes(t));
  }

  private extractStoreId(q: string): string | null {
    const match = q.match(/\bds-\d{4}\b/i);
    return match ? match[0].toUpperCase() : null;
  }

  private extractCity(q: string): string | null {
    const cities = [
      "delhi",
      "mumbai",
      "kolkata",
      "bengaluru",
      "bangalore",
      "hyderabad",
      "chennai",
      "pune",
      "ahmedabad",
      "jaipur",
      "surat",
      "lucknow",
      "indore",
      "chandigarh",
      "kochi",
    ];
    for (const c of cities) {
      if (q.includes(c)) {
        return c === "bangalore" ? "Bengaluru" : c.charAt(0).toUpperCase() + c.slice(1);
      }
    }
    return null;
  }

  private detectCityComparison(q: string): { city1: string; city2: string } | null {
    if (!q.includes("compare") && !q.includes("vs")) return null;
    const citiesFound: string[] = [];
    const allCities = [
      "mumbai",
      "delhi",
      "kolkata",
      "bengaluru",
      "bangalore",
      "hyderabad",
      "chennai",
      "pune",
      "indore",
    ];
    for (const c of allCities) {
      if (q.includes(c) && !citiesFound.includes(c)) {
        citiesFound.push(c.charAt(0).toUpperCase() + c.slice(1));
      }
    }
    if (citiesFound.length >= 2) {
      return { city1: citiesFound[0], city2: citiesFound[1] };
    }
    return null;
  }

  private getTimeRange(q: string, dashboardContext?: { timeFilter?: string }): TimeRange {
    const now = new Date();

    if (q.includes("today")) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date(), label: "today" };
    }
    if (q.includes("yesterday")) {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: "yesterday" };
    }
    if (q.includes("last 24 hours") || q.includes("24 hours") || q.includes("24h")) {
      return { start: new Date(Date.now() - 86400000), end: new Date(), label: "last 24 hours" };
    }
    if (q.includes("last 30 days") || q.includes("30 days") || q.includes("this month")) {
      return { start: new Date(Date.now() - 30 * 86400000), end: new Date(), label: "last 30 days" };
    }
    if (q.includes("90 days") || q.includes("last quarter")) {
      return { start: new Date(Date.now() - 90 * 86400000), end: new Date(), label: "last 90 days" };
    }
    if (q.includes("this week") || q.includes("last 7 days") || q.includes("7 days")) {
      return { start: new Date(Date.now() - 7 * 86400000), end: new Date(), label: "last 7 days" };
    }
    if (q.includes("last week")) {
      const end = new Date(Date.now() - 7 * 86400000);
      const start = new Date(Date.now() - 14 * 86400000);
      return { start, end, label: "last week" };
    }

    // Inherit from dashboardContext if present
    if (dashboardContext?.timeFilter === "30d") {
      return { start: new Date(Date.now() - 30 * 86400000), end: new Date(), label: "last 30 days" };
    }
    if (dashboardContext?.timeFilter === "90d") {
      return { start: new Date(Date.now() - 90 * 86400000), end: new Date(), label: "last 90 days" };
    }

    // Default: last 7 days
    return { start: new Date(Date.now() - 7 * 86400000), end: new Date(), label: "last 7 days" };
  }

  private getPriorPeriod(range: TimeRange): TimeRange {
    const durationMs = range.end.getTime() - range.start.getTime();
    const end = new Date(range.start.getTime());
    const start = new Date(end.getTime() - durationMs);
    return {
      start,
      end,
      label: `previous ${range.label}`,
    };
  }

  private getComparisonRange(q: string, currentRange: TimeRange): TimeRange {
    if (q.includes("last week")) {
      const end = new Date(Date.now() - 7 * 86400000);
      const start = new Date(Date.now() - 14 * 86400000);
      return { start, end, label: "last week" };
    }
    if (q.includes("last month")) {
      const end = new Date(Date.now() - 30 * 86400000);
      const start = new Date(Date.now() - 60 * 86400000);
      return { start, end, label: "last month" };
    }
    return this.getPriorPeriod(currentRange);
  }
}
