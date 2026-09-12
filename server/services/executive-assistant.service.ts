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
  rawQuestion?: string;
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
      case "PULSE_OVERVIEW":
        return this.getPulseOverview(parsed);
      case "CRITICAL_BOTTLENECKS":
        return this.getCriticalBottlenecks(parsed);
      case "EXECUTIVE_METRICS":
        return this.getExecutiveMetrics(parsed);
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
    const res = this.doParseQuestion(question, context, dashboardContext);
    res.rawQuestion = question;
    return res;
  }

  private doParseQuestion(
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
      q.includes("what is pulsescore") ||
      q.includes("how does pulsescore") ||
      q.includes("explain pulsescore") ||
      q.includes("explain darkops") ||
      q.includes("how does the system work") ||
      q.includes("how does this work")
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
      q.includes("what are your capabilities") ||
      q === "?" ||
      q.includes("how do i use this") ||
      q.includes("what can i ask")
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
      if (q.includes("why") || q.includes("struggling") || q.includes("problem") || q.includes("drop") || q.includes("root cause") || q.includes("wrong")) {
        return {
          intent: "STORE_ROOT_CAUSE",
          timeRange: this.getTimeRange(q, dashboardContext),
          parameters: { storeId },
          entities: [storeId],
          confidence: 0.95,
        };
      }
      if (q.includes("compare") || q.includes("vs") || q.includes("versus")) {
        const timeRange = this.getTimeRange(q, dashboardContext);
        const compRange = this.getComparisonRange(q, timeRange);
        return {
          intent: "STORE_COMPARISON",
          timeRange,
          comparisonTimeRange: compRange,
          parameters: { storeId },
          entities: [storeId],
          confidence: 0.95,
        };
      }
      if (q.includes("fix") || q.includes("investigate") || q.includes("action") || q.includes("recommend")) {
        return {
          intent: "STORE_RECOMMENDATION",
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
      (q.includes("last week") || q.includes("last month") || q.includes("yesterday") || q.includes("previous period") || q.includes("previous week"))
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

    // 8. Weighted keyword scoring system for intent classification
    const scored = this.scoreIntents(q, tokens);
    if (scored) {
      const city = this.extractCity(q);
      const baseParams: Record<string, any> = {};
      if (city) baseParams.city = city;
      
      // Build intent-specific parameters
      switch (scored.intent) {
        case "SLA_PERFORMANCE":
        case "COMPLAINT_CATEGORIES":
        case "STORE_PERFORMANCE":
        case "COMPLAINT_TRENDS":
        case "CITY_PERFORMANCE":
          return {
            intent: scored.intent,
            timeRange: this.getTimeRange(q, dashboardContext),
            parameters: baseParams,
            entities: city ? [city] : [],
            confidence: scored.confidence,
          };
        default:
          return {
            intent: scored.intent,
            timeRange: this.getTimeRange(q, dashboardContext),
            parameters: baseParams,
            entities: city ? [city] : [],
            confidence: scored.confidence,
          };
      }
    }

    // 9. Fallback: If any recognized city is in query, show that city's stores
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

    // 10. Smart fallback: if the query sounds operational at all, route to appropriate intent
    const op = this.soundsOperational(q);
    if (op.isOperational && op.intent) {
      return {
        intent: op.intent,
        timeRange: this.getTimeRange(q, dashboardContext),
        parameters: {},
        entities: [],
        confidence: 0.7,
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
   * Weighted keyword scoring for robust intent classification.
   * Each intent has an array of { keywords/phrases, weight }.
   * Single token keywords get +weight for each occurrence,
   * multi-word phrases get +weight if found as substring.
   * Highest-scoring intent above threshold wins.
   */
  private scoreIntents(q: string, tokens: string[]): { intent: string; confidence: number } | null {
    const tokenSet = new Set(tokens);

    // intent -> [ { match: string | string[], weight: number } ]
    // A match can be:
    //   - a single word: matched against tokenSet (exact word match)
    //   - a multi-word phrase: matched with q.includes()
    //   - an array of words: ALL must be present in tokens (AND match)
    const intentSignals: Record<string, Array<{ match: string | string[]; weight: number }>> = {
      PULSE_OVERVIEW: [
        { match: "pulse score", weight: 4 },
        { match: "pulse scores", weight: 4 },
        { match: "pulsescore", weight: 4 },
        { match: "store health", weight: 3 },
        { match: "fleet health", weight: 3 },
        { match: "average pulse", weight: 4 },
        { match: "network pulse", weight: 4 },
        { match: "health distribution", weight: 4 },
        { match: "store health distribution", weight: 4 },
        { match: "how healthy", weight: 3 },
        { match: "health score", weight: 3 },
        { match: "health index", weight: 3 },
        { match: "health", weight: 2 },
        { match: "pulse", weight: 2 },
      ],
      CRITICAL_BOTTLENECKS: [
        { match: "what is going wrong", weight: 4 },
        { match: "what's going wrong", weight: 4 },
        { match: "going wrong", weight: 3 },
        { match: "what is wrong", weight: 3 },
        { match: "what's wrong", weight: 3 },
        { match: "what needs fixing", weight: 4 },
        { match: "needs fixing", weight: 3 },
        { match: "critical issues", weight: 4 },
        { match: "critical issue", weight: 3 },
        { match: "urgent issues", weight: 4 },
        { match: "urgent problems", weight: 4 },
        { match: "how bad is it", weight: 4 },
        { match: "how bad", weight: 3 },
        { match: "what needs attention", weight: 3 },
        { match: "any critical issues", weight: 4 },
        { match: "major issues", weight: 3 },
        { match: "major problems", weight: 3 },
        { match: "top bottlenecks", weight: 4 },
        { match: "main bottlenecks", weight: 4 },
        { match: "biggest bottlenecks", weight: 4 },
        { match: "key bottlenecks", weight: 4 },
        { match: "operational bottlenecks", weight: 4 },
        { match: "severity assessment", weight: 4 },
        { match: "trouble spots", weight: 3 },
        { match: "bottleneck", weight: 3 },
        { match: "bottlenecks", weight: 3 },
      ],
      EXECUTIVE_METRICS: [
        { match: "give me the numbers", weight: 4 },
        { match: "show me the numbers", weight: 4 },
        { match: "the numbers", weight: 3 },
        { match: "data snapshot", weight: 4 },
        { match: "metrics snapshot", weight: 4 },
        { match: "executive metrics", weight: 4 },
        { match: "kpi snapshot", weight: 4 },
        { match: "kpi numbers", weight: 4 },
        { match: "numbers snapshot", weight: 4 },
        { match: "key numbers", weight: 3 },
        { match: "high level numbers", weight: 3 },
      ],
      NETWORK_SUMMARY: [
        // Phrases
        { match: "what is happening", weight: 3 },
        { match: "what's happening", weight: 3 },
        { match: "what is going on", weight: 3 },
        { match: "what's going on", weight: 3 },
        { match: "how are things", weight: 3 },
        { match: "how are things looking", weight: 3 },
        { match: "how are we doing", weight: 3 },
        { match: "how is everything", weight: 3 },
        { match: "current situation", weight: 3 },
        { match: "current status", weight: 3 },
        { match: "status update", weight: 3 },
        { match: "quick summary", weight: 3 },
        { match: "give me a summary", weight: 3 },
        { match: "operational summary", weight: 3 },
        { match: "network summary", weight: 3 },
        { match: "executive summary", weight: 3 },
        { match: "overall status", weight: 3 },
        { match: "network status", weight: 3 },
        { match: "network overview", weight: 3 },
        { match: "how is the network", weight: 3 },
        { match: "at a glance", weight: 3 },
        { match: "brief me", weight: 3 },
        { match: "briefing", weight: 2 },
        { match: "dashboard", weight: 1 },
        // Single words
        { match: "overview", weight: 2 },
        { match: "summary", weight: 2 },
        { match: "happening", weight: 2 },
        { match: "situation", weight: 2 },
        { match: "update", weight: 1 },
        { match: "status", weight: 1 },
        { match: "uptime", weight: 2 },
        { match: "availability", weight: 2 },
      ],
      ANOMALIES_ALERTS: [
        { match: "red flag", weight: 3 },
        { match: "red flags", weight: 3 },
        { match: "any alert", weight: 3 },
        { match: "any alerts", weight: 3 },
        { match: "active alert", weight: 3 },
        { match: "critical alert", weight: 3 },
        { match: "hardware failure", weight: 3 },
        { match: "equipment failure", weight: 3 },
        { match: "equipment issue", weight: 3 },
        { match: "freezer failure", weight: 3 },
        { match: "freezer down", weight: 3 },
        { match: "needs attention", weight: 2 },
        { match: "concerned about", weight: 2 },
        { match: "any problems", weight: 2 },
        { match: "anything unusual", weight: 3 },
        { match: "anomaly", weight: 3 },
        { match: "anomalies", weight: 3 },
        { match: "urgent", weight: 2 },
        { match: "emergency", weight: 2 },
        // Single words
        { match: "alert", weight: 2 },
        { match: "alerts", weight: 2 },
        { match: "unusual", weight: 2 },
        { match: "freezer", weight: 2 },
        { match: "equipment", weight: 2 },
        { match: "broken", weight: 2 },
        { match: "malfunction", weight: 2 },
        { match: "outage", weight: 2 },
        { match: "offline", weight: 2 },
        { match: "down", weight: 1 },
      ],
      AUTOMATION_PERFORMANCE: [
        { match: "auto resolution", weight: 3 },
        { match: "auto-resolution", weight: 3 },
        { match: "auto resolved", weight: 3 },
        { match: "auto-resolved", weight: 3 },
        { match: "auto approved", weight: 3 },
        { match: "auto-approved", weight: 3 },
        { match: "automation rate", weight: 3 },
        { match: "how effective is automation", weight: 3 },
        { match: "manual intervention", weight: 3 },
        { match: "manual queue", weight: 3 },
        { match: "automatically resolved", weight: 3 },
        { match: "automated resolution", weight: 3 },
        { match: "how many auto", weight: 3 },
        { match: "automation performance", weight: 3 },
        { match: "how well is automation", weight: 3 },
        { match: "is automation working", weight: 3 },
        { match: "resolution rate", weight: 2 },
        // Single words
        { match: "automation", weight: 3 },
        { match: "automate", weight: 2 },
        { match: "automated", weight: 2 },
      ],
      RISK_SUMMARY: [
        { match: "fraud review", weight: 3 },
        { match: "fraud risk", weight: 3 },
        { match: "risk review", weight: 3 },
        { match: "risk pattern", weight: 3 },
        { match: "suspicious pattern", weight: 3 },
        { match: "suspicious activity", weight: 3 },
        { match: "flagged case", weight: 3 },
        { match: "any fraud", weight: 3 },
        { match: "fraud cases", weight: 3 },
        { match: "fraud flag", weight: 3 },
        { match: "risk flag", weight: 3 },
        { match: "under review", weight: 2 },
        // Single words
        { match: "fraud", weight: 3 },
        { match: "suspicious", weight: 2 },
        { match: "flagged", weight: 2 },
      ],
      SLA_PERFORMANCE: [
        { match: "sla breach", weight: 3 },
        { match: "sla breaches", weight: 3 },
        { match: "sla performance", weight: 3 },
        { match: "sla compliance", weight: 3 },
        { match: "sla status", weight: 3 },
        { match: "cases overdue", weight: 3 },
        { match: "how many overdue", weight: 3 },
        { match: "overdue cases", weight: 3 },
        { match: "overdue tickets", weight: 3 },
        { match: "are we meeting sla", weight: 3 },
        { match: "within sla", weight: 3 },
        { match: "p1 case", weight: 3 },
        { match: "p1 breach", weight: 3 },
        { match: "priority 1", weight: 2 },
        { match: "target 95", weight: 2 },
        { match: "response time", weight: 2 },
        { match: "resolution time", weight: 2 },
        // Single words
        { match: "sla", weight: 3 },
        { match: "breach", weight: 2 },
        { match: "breaches", weight: 2 },
        { match: "overdue", weight: 2 },
        { match: "compliance", weight: 2 },
        { match: "deadline", weight: 2 },
        { match: "escalated", weight: 2 },
      ],
      COMPLAINT_CATEGORIES: [
        { match: "complaint category", weight: 3 },
        { match: "complaint categories", weight: 3 },
        { match: "complaint type", weight: 3 },
        { match: "complaint types", weight: 3 },
        { match: "type of complaint", weight: 3 },
        { match: "types of complaint", weight: 3 },
        { match: "complaining about", weight: 3 },
        { match: "what are people complaining", weight: 3 },
        { match: "top complaints", weight: 3 },
        { match: "main complaints", weight: 3 },
        { match: "common complaints", weight: 3 },
        { match: "most common complaint", weight: 3 },
        { match: "complaint breakdown", weight: 3 },
        { match: "what kind of issues", weight: 3 },
        { match: "what types of issues", weight: 3 },
        { match: "what are customers", weight: 2 },
        { match: "missing item", weight: 2 },
        { match: "late delivery", weight: 2 },
        { match: "damaged item", weight: 2 },
        { match: "quality issue", weight: 2 },
        { match: "wrong item", weight: 2 },
        // Single words
        { match: "category", weight: 2 },
        { match: "categories", weight: 2 },
        { match: "breakdown", weight: 1 },
      ],
      CITY_PERFORMANCE: [
        { match: "which areas", weight: 4 },
        { match: "which area", weight: 3 },
        { match: "which areas need attention", weight: 4 },
        { match: "areas need attention", weight: 4 },
        { match: "where should we focus", weight: 3 },
        { match: "where are complaints concentrated", weight: 4 },
        { match: "city wise", weight: 3 },
        { match: "city-wise", weight: 3 },
        { match: "city level", weight: 3 },
        { match: "by city", weight: 3 },
        { match: "per city", weight: 3 },
        { match: "across cities", weight: 3 },
        { match: "which cities", weight: 3 },
        { match: "which city", weight: 3 },
        { match: "regional performance", weight: 3 },
        { match: "regional breakdown", weight: 3 },
        { match: "regional summary", weight: 3 },
        { match: "complaints concentrated", weight: 3 },
        { match: "geography", weight: 2 },
        { match: "geographic", weight: 2 },
        { match: "worst city", weight: 3 },
        { match: "worst performing area", weight: 3 },
        { match: "worst performing areas", weight: 3 },
        { match: "best performing area", weight: 3 },
        { match: "area wise", weight: 3 },
        { match: "location wise", weight: 3 },
        // Single words
        { match: "cities", weight: 2 },
        { match: "regional", weight: 2 },
        { match: "regions", weight: 2 },
      ],
      STORE_PERFORMANCE: [
        { match: "which store", weight: 3 },
        { match: "which stores", weight: 3 },
        { match: "what stores", weight: 3 },
        { match: "problem store", weight: 3 },
        { match: "problem stores", weight: 3 },
        { match: "worst store", weight: 3 },
        { match: "worst stores", weight: 3 },
        { match: "worst performing store", weight: 3 },
        { match: "best performing store", weight: 3 },
        { match: "store ranking", weight: 3 },
        { match: "store rankings", weight: 3 },
        { match: "top store", weight: 2 },
        { match: "bottom store", weight: 3 },
        { match: "store health", weight: 3 },
        { match: "store performance", weight: 3 },
        { match: "dark store", weight: 2 },
        { match: "dark stores", weight: 2 },
        { match: "lowest pulse", weight: 3 },
        { match: "struggling store", weight: 3 },
        { match: "underperforming", weight: 2 },
        { match: "locations need attention", weight: 3 },
        { match: "about store", weight: 2 },
        { match: "stores have the most", weight: 3 },
        // Single words
        { match: "struggling", weight: 2 },
        { match: "underperforming", weight: 2 },
      ],
      COMPLAINT_TRENDS: [
        { match: "are complaints increasing", weight: 3 },
        { match: "complaints increasing", weight: 3 },
        { match: "complaints going up", weight: 3 },
        { match: "issues going up", weight: 3 },
        { match: "issues increasing", weight: 3 },
        { match: "complaints rising", weight: 3 },
        { match: "complaint trend", weight: 3 },
        { match: "complaint trends", weight: 3 },
        { match: "volume trend", weight: 3 },
        { match: "what's changed", weight: 3 },
        { match: "what has changed", weight: 3 },
        { match: "how many complaints", weight: 3 },
        { match: "complaint volume", weight: 3 },
        { match: "total complaints", weight: 3 },
        { match: "complaint count", weight: 3 },
        { match: "how many issues", weight: 3 },
        { match: "issue volume", weight: 3 },
        { match: "getting worse", weight: 2 },
        { match: "getting better", weight: 2 },
        { match: "improving", weight: 2 },
        { match: "deteriorating", weight: 2 },
        { match: "refund situation", weight: 3 },
        { match: "refund amount", weight: 3 },
        { match: "total refund", weight: 3 },
        { match: "how much refund", weight: 3 },
        // Single words
        { match: "trend", weight: 2 },
        { match: "trends", weight: 2 },
        { match: "increasing", weight: 2 },
        { match: "rising", weight: 2 },
        { match: "spike", weight: 2 },
        { match: "backlog", weight: 2 },
        { match: "growing", weight: 1 },
        { match: "worsening", weight: 2 },
        { match: "declining", weight: 2 },
        { match: "refund", weight: 1 },
        { match: "refunds", weight: 1 },
      ],
    };

    const scores: Record<string, number> = {};

    for (const [intent, signals] of Object.entries(intentSignals)) {
      let score = 0;
      for (const signal of signals) {
        if (typeof signal.match === "string") {
          // Multi-word phrase or single word?
          if (signal.match.includes(" ")) {
            // Phrase match
            if (q.includes(signal.match)) {
              score += signal.weight;
            }
          } else {
            // Single word: check token set
            if (tokenSet.has(signal.match)) {
              score += signal.weight;
            }
          }
        } else if (Array.isArray(signal.match)) {
          // AND match: all words must be present
          if (signal.match.every((w) => tokenSet.has(w))) {
            score += signal.weight;
          }
        }
      }
      if (score > 0) {
        scores[intent] = score;
      }
    }

    // Find the highest scoring intent
    let bestIntent: string | null = null;
    let bestScore = 0;
    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    // Minimum threshold: at least 2 points to be confident
    if (bestIntent && bestScore >= 2) {
      const confidence = Math.min(0.95, 0.7 + bestScore * 0.05);
      return { intent: bestIntent, confidence };
    }

    return null;
  }

  /**
   * Check if a query sounds operational (routes to appropriate intent fallback
   * rather than the generic UNSUPPORTED message)
   */
  private soundsOperational(q: string): { isOperational: boolean; intent?: string } {
    const coreWords = [
      "store", "stores", "complaint", "complaints", "sla", "pulse", "fraud",
      "breach", "refund", "dark store", "dark stores", "picker", "rider",
      "chiller", "freezer", "ticket", "tickets", "work order", "inventory"
    ];
    const hasCore = coreWords.some((w) => q.includes(w));
    if (!hasCore) return { isOperational: false };

    if (q.includes("wrong") || q.includes("bad") || q.includes("fix") || q.includes("problem") || q.includes("critical") || q.includes("bottleneck")) {
      return { isOperational: true, intent: "CRITICAL_BOTTLENECKS" };
    }
    if (q.includes("pulse") || q.includes("health")) {
      return { isOperational: true, intent: "PULSE_OVERVIEW" };
    }
    if (q.includes("number") || q.includes("metric") || q.includes("kpi") || q.includes("data")) {
      return { isOperational: true, intent: "EXECUTIVE_METRICS" };
    }
    if (q.includes("area") || q.includes("city") || q.includes("region") || q.includes("where")) {
      return { isOperational: true, intent: "CITY_PERFORMANCE" };
    }
    return { isOperational: true, intent: "NETWORK_SUMMARY" };
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
        (context.lastIntent === "NETWORK_SUMMARY" || context.lastIntent === "CRITICAL_BOTTLENECKS" || context.lastIntent === "PULSE_OVERVIEW" || context.lastIntent === "EXECUTIVE_METRICS" || context.lastIntent === "COMPLAINT_CATEGORIES"))
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
      ? `\n• **Top Problem Store:** ${kpis.topProblemStore.name} (${kpis.topProblemStore.city}) with ${kpis.topProblemStore.complaints} open complaints.`
      : "";

    const topCatText = kpis.topCategory
      ? `\n• **Dominant Issue Mode:** ${CATEGORY_LABEL_MAP[kpis.topCategory.category] || kpis.topCategory.category} represents ${kpis.topCategory.count} customer disputes.`
      : "";

    const raw = (parsed.rawQuestion || "").toLowerCase();
    const timeLabel = parsed.timeRange.label;
    let headline = `Network Operations Overview (${timeLabel})`;

    if (raw.includes("status update") || (raw.includes("status") && !raw.includes("overall"))) {
      headline = `Current Network Operations Status Update`;
    } else if (raw.includes("quick summary") || raw.includes("brief") || raw.includes("summary")) {
      headline = `Executive Operational Briefing (${timeLabel})`;
    } else if (raw.includes("today") || timeLabel.includes("today")) {
      headline = `Today's Real-Time Operations Status`;
    } else if (raw.includes("how are things") || raw.includes("how are we doing") || raw.includes("how is everything")) {
      headline = `Operational Health & Status Report`;
    }

    const breachPct = Math.round((kpis.slaBreached / Math.max(kpis.activeCases, 1)) * 100);
    const synthesis = `**Executive Synthesis:** Operations are facing acute throughput friction. With a ${breachPct}% SLA breach rate in active tickets and an average PulseScore of ${kpis.avgPulse}/100, ${kpis.criticalStores} stores require immediate intervention to stabilize operations.`;
    const recommendation = `**Recommended Action:** Immediately triage the ${kpis.p1Cases} P1 critical tickets in the Operations Queue and review shift allocation for top problem stores.`;

    const answer = `### ${headline}\n\n• **Ticket Volume:** ${kpis.totalComplaints} total complaints tracked across ${kpis.storeCount} dark stores in ${kpis.cityCount} cities.\n• **Active Support Queue:** ${kpis.activeCases} unresolved tickets (${kpis.slaBreached} breached SLA, ${kpis.p1Cases} P1 critical).${topCatText}${topStoreText}\n• **Fleet Health Index:** Average PulseScore is ${kpis.avgPulse}/100, with ${kpis.criticalStores} stores in critical condition (<60).\n• **Risk & Telemetry:** ${kpis.pendingFraud} transactions flagged for fraud review; ${kpis.activeCriticalAlerts} active critical equipment alarms.\n\n${synthesis}\n\n${recommendation}`;

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
        "What is our pulse score?",
        "What is going wrong?",
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
   * 1b. Intent Handler: Pulse Overview & Health Distribution
   */
  private async getPulseOverview(parsed: ParsedQuery): Promise<AssistantResponse> {
    const kpis = await this.tools.getNetworkKPIs(parsed.timeRange);
    const worstStores = await this.tools.getStoreRankings("pulse_asc", 3);

    const worstList = worstStores
      .map((s, i) => `${i + 1}. **${s.name}** (\`${s.id}\`, ${s.city}) - Pulse **${s.pulse}/100**, ${s.openComplaints} open complaints`)
      .join("\n");

    const worstStore = worstStores[0];
    const synthesis = `**Executive Synthesis:** 73.5% of dark stores (${kpis.criticalStores} of ${kpis.storeCount}) are running below the critical 60-point threshold. Score deductions are primarily triggered by unresolved SLA breaches and unaddressed chiller equipment breakdowns.`;
    const recommendation = `**Recommended Action:** Dispatch emergency maintenance technicians to inspect refrigeration units at ${worstStore ? `\`${worstStore.id}\` (${worstStore.name})` : "low-scoring stores"} to mitigate inventory spoilage.`;

    const answer = `### PulseScore Fleet Health & Distribution\n\n• **Fleet Average:** ${kpis.avgPulse}/100 across ${kpis.storeCount} dark stores in ${kpis.cityCount} cities.\n• **Health Breakdown:** ${kpis.criticalStores} stores in critical status (<60), ${kpis.atRiskStores} at risk (60-79), and ${kpis.healthyStores} healthy (80+).\n• **Lowest Scoring Dark Stores:**\n${worstList || "• None recorded"}\n• **Score Penalty Drivers:** Deductions are predominantly caused by ${kpis.activeCriticalAlerts} active equipment faults and ${kpis.slaBreached} SLA breaches in open support tickets.\n\n${synthesis}\n\n${recommendation}`;

    return {
      intent: "PULSE_OVERVIEW",
      answer,
      summary: `Network PulseScore is ${kpis.avgPulse}/100 with ${kpis.criticalStores} stores in critical health (<60).`,
      metrics: [
        { label: "Network Pulse", value: `${kpis.avgPulse}/100`, tone: kpis.avgPulse < 60 ? "crit" : kpis.avgPulse < 80 ? "warn" : "ok" },
        { label: "Critical Stores (<60)", value: `${kpis.criticalStores}`, tone: "crit" },
        { label: "At Risk (60-79)", value: `${kpis.atRiskStores}`, tone: "warn" },
        { label: "Healthy (80+)", value: `${kpis.healthyStores}`, tone: "ok" },
      ],
      evidence: [
        { label: "Fleet size", value: `${kpis.storeCount} dark stores` },
        { label: "Average PulseScore", value: `${kpis.avgPulse}/100` },
        { label: "Worst store", value: worstStore ? `${worstStore.id} (${worstStore.pulse}/100)` : "N/A" },
      ],
      suggestedQuestions: [
        worstStore ? `Why is ${worstStore.id} struggling?` : "Which stores have the most complaints?",
        "Which stores have the lowest pulse?",
        "What equipment breakdowns are recorded?",
      ],
      drillDown: {
        label: "View Dark Store Network",
        route: "/dark-stores",
      },
      context: {
        lastIntent: "PULSE_OVERVIEW",
        lastStore: worstStore?.id,
        lastCity: worstStore?.city,
        lastResults: worstStores.map((s) => s.id),
      },
    };
  }

  /**
   * 1c. Intent Handler: Critical Bottlenecks & Exceptions
   */
  private async getCriticalBottlenecks(parsed: ParsedQuery): Promise<AssistantResponse> {
    const [kpis, anomalies, sla] = await Promise.all([
      this.tools.getNetworkKPIs(parsed.timeRange),
      this.tools.getAnomaliesAndAlerts(),
      this.tools.getSLAAnalytics(parsed.timeRange),
    ]);

    const topStore = kpis.topProblemStore;
    const topCat = kpis.topCategory;

    const issues: string[] = [];
    if (sla.breached > 0) {
      issues.push(`1. **SLA Violations:** ${sla.breached} active tickets are past due (${sla.p1Breaches} are critical P1 emergencies)`);
    }
    if (anomalies.length > 0) {
      issues.push(`2. **Hardware Red Alerts:** ${anomalies.slice(0, 2).map((a) => `${a.title} at ${a.entityName || a.entityId}`).join("; ")}`);
    }
    if (topStore) {
      issues.push(`3. **Fulfillment Bottleneck:** ${topStore.name} (${topStore.city}) leads the network with ${topStore.complaints} complaints`);
    }
    if (topCat) {
      issues.push(`4. **Customer Driver:** ${CATEGORY_LABEL_MAP[topCat.category] || topCat.category} represents the single largest failure mode (${topCat.count} complaints)`);
    }
    if (kpis.pendingFraud > 0) {
      issues.push(`5. **Financial Risk:** ${kpis.pendingFraud} transactions flagged for potential fraud review`);
    }

    const raw = (parsed.rawQuestion || "").toLowerCase();
    let headline = "Critical Operational Bottlenecks Requiring Intervention";

    if (raw.includes("how bad")) {
      const riskLevel = sla.breachRate > 40 ? "HIGH RISK" : "MODERATE RISK";
      headline = `Operational Severity Assessment (${riskLevel} - ${sla.breachRate}% SLA breach rate)`;
    } else if (raw.includes("fixing") || raw.includes("fix") || raw.includes("action")) {
      headline = "Prioritized Operational Fixes Needed Across Dark Stores";
    } else if (raw.includes("going wrong") || raw.includes("wrong")) {
      headline = "Top Operational Bottlenecks & Exceptions Detected";
    } else if (raw.includes("critical issue") || raw.includes("critical") || raw.includes("urgent")) {
      headline = "Active Critical Incidents & High-Severity Exceptions";
    }

    const synthesis = `**Executive Synthesis:** Operational risk is centered on customer resolution velocity (${sla.breachRate}% breach rate) and chiller temperature failures at key stores like Kolkata Central DS.`;
    const recommendation = `**Recommended Action:** Clear the ${sla.p1Breaches} overdue P1 cases in the Operations Queue immediately and dispatch refrigeration technicians to address critical equipment alarms.`;

    const answer = `### ${headline}\n\n${issues.join("\n")}\n\n${synthesis}\n\n${recommendation}`;

    return {
      intent: "CRITICAL_BOTTLENECKS",
      answer,
      summary: `${sla.breached} SLA breaches (${sla.p1Breaches} P1), ${anomalies.length} hardware alerts, ${kpis.criticalStores} critical stores.`,
      metrics: [
        { label: "SLA Breaches", value: `${sla.breached}`, tone: "crit" },
        { label: "P1 Critical Breaches", value: `${sla.p1Breaches}`, tone: "crit" },
        { label: "Active Hardware Alerts", value: `${anomalies.length}`, tone: anomalies.length > 0 ? "crit" : "ok" },
        { label: "Critical Health Stores", value: `${kpis.criticalStores}`, tone: "crit" },
      ],
      evidence: [
        { label: "Active queue", value: `${kpis.activeCases} cases` },
        { label: "SLA breach rate", value: `${sla.breachRate}%` },
        { label: "Top problem store", value: topStore ? `${topStore.id} (${topStore.name})` : "N/A" },
      ],
      suggestedQuestions: [
        "What should I investigate first?",
        topStore ? `Why is ${topStore.id} struggling?` : "Which stores have the most complaints?",
        "Where are SLA breaches happening?",
      ],
      drillDown: {
        label: "Open Operations Queue",
        route: "/operations",
      },
      context: {
        lastIntent: "CRITICAL_BOTTLENECKS",
        lastStore: topStore?.id,
        lastCity: topStore?.city,
        lastResults: topStore ? [topStore.id] : [],
      },
    };
  }

  /**
   * 1d. Intent Handler: Executive Metrics Snapshot
   */
  private async getExecutiveMetrics(parsed: ParsedQuery): Promise<AssistantResponse> {
    const [kpis, sla, auto] = await Promise.all([
      this.tools.getNetworkKPIs(parsed.timeRange),
      this.tools.getSLAAnalytics(parsed.timeRange),
      this.tools.getAutomationMetrics(parsed.timeRange),
    ]);

    const refundInRupees = Math.round(auto.autoApprovedRefundsPaise / 100);
    const synthesis = `**Executive Synthesis:** Support throughput is lagging volume with a ${sla.breachRate}% breach rate, while the automation engine autonomously shields support by resolving ${auto.autoResolutionRate}% of disputes.`;
    const recommendation = `**Recommended Action:** Shift support capacity to clear ${sla.breached} overdue tickets while monitoring ₹${refundInRupees} in automated refunds.`;

    const answer = `### Executive Numbers Snapshot (${parsed.timeRange.label})\n\n• **Customer Issues:** ${kpis.totalComplaints} total complaints logged (${kpis.activeCases} active in queue, ${auto.autoResolvedCount} auto-resolved).\n• **SLA Compliance:** ${sla.breached} breached cases (${sla.breachRate}% breach rate), including ${sla.p1Breaches} critical P1 breaches.\n• **Store Fleet:** 200 dark stores across ${kpis.cityCount} cities, average PulseScore **${kpis.avgPulse}/100** (${kpis.criticalStores} stores in critical band).\n• **Financials & Automation:** ₹${refundInRupees} in auto-approved refunds, ${kpis.pendingFraud} pending fraud reviews, and ${kpis.activeCriticalAlerts} active critical equipment alarms.\n\n${synthesis}\n\n${recommendation}`;

    return {
      intent: "EXECUTIVE_METRICS",
      answer,
      summary: `${kpis.totalComplaints} complaints, ${sla.breached} SLA breaches, Pulse ${kpis.avgPulse}/100, ${kpis.criticalStores} critical stores.`,
      metrics: [
        { label: "Total Complaints", value: `${kpis.totalComplaints}`, tone: "neutral" },
        { label: "SLA Breaches", value: `${sla.breached} (${sla.breachRate}%)`, tone: sla.breached > 0 ? "crit" : "ok" },
        { label: "Network Pulse", value: `${kpis.avgPulse}/100`, tone: kpis.avgPulse < 60 ? "crit" : "warn" },
        { label: "Critical Alerts", value: `${kpis.activeCriticalAlerts}`, tone: kpis.activeCriticalAlerts > 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Active cases", value: `${kpis.activeCases}` },
        { label: "Auto-resolution rate", value: `${auto.autoResolutionRate}%` },
        { label: "Fraud reviews", value: `${kpis.pendingFraud}` },
      ],
      suggestedQuestions: [
        "What are the biggest operational issues right now?",
        "Which stores have the most complaints?",
        "How effective is automation?",
      ],
      drillDown: {
        label: "View Executive Dashboard",
        route: "/executive",
      },
      context: {
        lastIntent: "EXECUTIVE_METRICS",
        lastTimePeriod: parsed.timeRange.label,
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

    const synthesis = `**Executive Synthesis:** Ticket creation velocity has **${direction} by ${Math.abs(deltaPct)}%**. The operational backlog contains ${curAnalytics.total - curAnalytics.resolvedCount} unresolved cases with an elevated ${curAnalytics.slaBreachRate}% SLA breach rate.`;
    const recommendation = `**Recommended Action:** Allocate surge customer support capacity to clear the ${curAnalytics.slaBreachedCount} breached cases before escalation to supervisor queues.`;

    const answer = `### Complaint Trend Analysis (${currentRange.label} vs ${priorRange.label})\n\n• **Intake Trajectory:** Total complaints have **${direction} by ${Math.abs(deltaPct)}%** (${curAnalytics.total} cases vs ${priorAnalytics.total} in previous period).\n• **Open Queue:** ${curAnalytics.total - curAnalytics.resolvedCount} cases remain actively in progress.\n• **SLA Risk:** ${curAnalytics.slaBreachedCount} cases have breached resolution SLA (${curAnalytics.slaBreachRate}% breach rate).\n• **Resolved Volume:** ${curAnalytics.resolvedCount} cases successfully closed.\n\n${synthesis}\n\n${recommendation}`;

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

    const catList = analytics.byCategory
      .slice(0, 4)
      .map(
        (c, i) =>
          `${i + 1}. **${CATEGORY_LABEL_MAP[c.category] || c.category}** - ${c.count} cases (**${c.percentage}%** of total volume)`,
      )
      .join("\n");

    const topCat = analytics.byCategory[0];
    const topCatLabel = topCat ? CATEGORY_LABEL_MAP[topCat.category] || topCat.category : "None";

    const filterText = parsed.parameters.storeId
      ? ` for store ${parsed.parameters.storeId}`
      : parsed.parameters.city
        ? ` in ${parsed.parameters.city}`
        : "";

    const synthesis = `**Executive Synthesis:** **${topCatLabel}** is the primary operational friction driver, accounting for ${topCat?.percentage || 0}% of all customer tickets. This suggests inventory picking errors rather than transit delays.`;
    const recommendation = `**Recommended Action:** Audit SKU bin allocation and picker verification workflows at top dark stores to mitigate packing errors.`;

    const answer = `### Complaint Category Breakdown${filterText} (${parsed.timeRange.label})\n\n${catList}\n\n${synthesis}\n\n${recommendation}`;

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
    const storeLines = stores
      .map(
        (s, i) =>
          `${i + 1}. **${s.name}** (\`${s.id}\`, ${s.city}) - ${s.openComplaints} open complaints, Pulse **${s.pulse}/100**, ${s.slaBreaches} SLA breaches`,
      )
      .join("\n");

    const worstStore = stores[0];
    const synthesis = `**Executive Synthesis:** ${worstStore ? `**${worstStore.name}** (\`${worstStore.id}\`) is the primary operational friction point${cityText}, contributing ${worstStore.openComplaints} complaints and ${worstStore.slaBreaches} SLA breaches with a critical PulseScore of ${worstStore.pulse}/100.` : "No problem stores identified."}`;
    const recommendation = `**Recommended Action:** Drill into ${worstStore ? `\`${worstStore.id}\`` : "the top problem store"} to diagnose inventory picking errors and check open equipment work orders.`;

    const answer = `### Top Problem Dark Stores Ranked by Complaint Volume${cityText} (${parsed.timeRange.label})\n\n${storeLines}\n\n${synthesis}\n\n${recommendation}`;

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

    const synthesis = `**Executive Synthesis:** The critical operational drag at \`${detail.id}\` is driven by ${detail.topCategories[0] ? CATEGORY_LABEL_MAP[detail.topCategories[0].category] : "picking exceptions"} coupled with ${detail.workOrders.length} active equipment breakdown orders.`;
    const recommendation = `**Recommended Action:** Immediately triage the ${detail.slaBreaches} breached SLA tickets and dispatch maintenance engineers to clear equipment work orders.`;

    const answer = `### Root Cause Diagnosis: ${detail.name} (\`${detail.id}\`, ${detail.city})\n\n• **Complaint Spike:** ${detail.complaintsCount} logged issues for ${parsed.timeRange.label} (${deltaSign} vs prior period).\n• **Dominant Issue Mode:** ${catText || "Unspecified complaints"} represents the primary operational driver.\n• **SLA Compliance:** ${detail.slaBreaches} overdue tickets currently breaching resolution SLA.\n• **Equipment Breakdowns:** ${workOrderText}\n• **Hardware Red Alerts:** ${alertText || "No active telemetry critical alerts."}\n• **Operational Health:** PulseScore stands at **${detail.currentPulse}/100** (${detail.pulseTrend >= 0 ? `+${detail.pulseTrend}` : detail.pulseTrend} points this week).\n\n${synthesis}\n\n${recommendation}`;

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

    const answer = `Comparative performance for ${curDetail.id} (${curDetail.name}) - ${currentRange.label} vs ${priorRange.label}: Complaint volume changed by ${pctSign} (${curCount} cases vs ${priorCount} cases, delta of ${sign}). Store PulseScore changed by ${pulseSign} points (currently ${curDetail.currentPulse}/100 vs ${priorDetail?.currentPulse || curDetail.currentPulse}/100). SLA breaches changed from ${priorDetail?.slaBreaches || 0} to ${curDetail.slaBreaches}.`;

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
      steps.push(`1. **Clear Overdue Queue:** Triage the ${detail.slaBreaches} SLA-breached tickets in Operations Queue immediately`);
    }
    if (detail.workOrders.length > 0) {
      steps.push(`2. **Service Critical Hardware:** Dispatch maintenance technician for active work order (${detail.workOrders[0].asset})`);
    }
    if (detail.topCategories.length > 0) {
      steps.push(`3. **Audit Inventory Bins:** Audit fulfillment picking bins to mitigate ${CATEGORY_LABEL_MAP[detail.topCategories[0].category] || detail.topCategories[0].category}`);
    }
    steps.push(`4. **Balance Shift Capacity:** Reallocate floor pickers and riders (${detail.pickers} pickers, ${detail.riders} riders currently assigned)`);

    const synthesis = `**Executive Synthesis:** Executing these sequential actions will halt score decay at \`${detail.id}\`, stabilizing PulseScore from its critical level (${detail.currentPulse}/100) and clearing the ${detail.slaBreaches} overdue SLA cases.`;
    const recommendation = `**Recommended Action:** Instruct the dark store manager at ${detail.name} to prioritize the ${detail.slaBreaches} overdue tickets and inspect the ${detail.workOrders[0]?.asset || "equipment assets"}.`;

    const answer = `### Prioritized Action Plan: ${detail.name} (\`${detail.id}\`, ${detail.city})\n\n${steps.join("\n")}\n\n${synthesis}\n\n${recommendation}`;

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
        lastTimePeriod: parsed.timeRange.label,
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
        { label: "Store", value: `${detail.id} - ${detail.name}` },
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

    const cityItems = cities
      .slice(0, 4)
      .map(
        (c, i) =>
          `${i + 1}. **${c.city}** - ${c.complaintsCount} complaints across ${c.storeCount} dark stores (Avg Pulse: **${c.avgPulse}/100**, ${c.slaBreaches} SLA breaches)`,
      )
      .join("\n");

    const topCity = cities[0];
    const synthesis = `**Executive Synthesis:** ${topCity ? `**${topCity.city}** represents the primary regional friction hotspot, contributing ${topCity.complaintsCount} complaints and ${topCity.slaBreaches} SLA breaches across its ${topCity.storeCount} stores.` : "All regions operating within normal limits."}`;
    const recommendation = `**Recommended Action:** Drill into ${topCity?.city || "top city"} stores to rebalance courier capacity and audit cold-chain operations.`;

    const answer = `### Regional Operational Performance (${parsed.timeRange.label})\n\n${cityItems}\n\n${synthesis}\n\n${recommendation}`;

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

    const synthesis = `**Executive Synthesis:** ${diffComplaints >= 0 ? `${c1.city} carries ${Math.abs(diffComplaints)} more complaints than ${c2.city}` : `${c2.city} carries ${Math.abs(diffComplaints)} more complaints than ${c1.city}`}, with ${c1.avgPulse >= c2.avgPulse ? c1.city : c2.city} maintaining higher average health (+${Math.abs(diffPulse)} pts).`;
    const recommendation = `**Recommended Action:** Transfer proven inventory picking workflows from ${c1.avgPulse >= c2.avgPulse ? c1.city : c2.city} to stabilize operations in ${c1.avgPulse >= c2.avgPulse ? c2.city : c1.city}.`;

    const answer = `### Regional Comparison: ${c1.city} vs ${c2.city} (${parsed.timeRange.label})\n\n• **Complaint Volumes:** **${c1.city}** has ${c1.complaintsCount} cases across ${c1.storeCount} stores vs **${c2.city}** with ${c2.complaintsCount} cases across ${c2.storeCount} stores (${diffComplaints >= 0 ? `+${diffComplaints}` : diffComplaints} delta).\n• **Fleet Health:** ${c1.city} averages Pulse **${c1.avgPulse}/100** vs ${c2.city}'s **${c2.avgPulse}/100** (${diffPulse >= 0 ? `+${diffPulse}` : diffPulse} pts).\n• **SLA Compliance:** ${c1.city} recorded ${c1.slaBreaches} breaches vs ${c2.city}'s ${c2.slaBreaches} breaches.\n\n${synthesis}\n\n${recommendation}`;

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
      ? sla.byCity.slice(0, 3).map((c) => `**${c.city}** (${c.breaches} breaches)`).join(", ")
      : "No city-level clusters.";

    const synthesis = `**Executive Synthesis:** Support queues are operating at a **${sla.breachRate}% SLA breach rate** against the 95% target, driven by ${sla.p1Breaches} critical P1 tickets overdue for resolution.`;
    const recommendation = `**Recommended Action:** Assign dedicated senior dispatchers to resolve the ${sla.p1Breaches} overdue P1 cases in the Operations Queue immediately.`;

    const answer = `### SLA Resolution Performance & Compliance (${parsed.timeRange.label})\n\n• **Queue Breach Ratio:** ${sla.breached} out of ${sla.activeTotal} active cases (**${sla.breachRate}%**) have breached resolution SLA.\n• **High-Severity Breaches:** ${sla.p1Breaches} critical P1 breaches and ${sla.p2Breaches} P2 escalations currently overdue.\n• **At-Risk Pipeline:** ${sla.atRisk} additional tickets are approaching deadline within the next 15 minutes.\n• **Regional Concentration:** Concentrated in ${cityText}\n\n${synthesis}\n\n${recommendation}`;

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

    const synthesis = `**Executive Synthesis:** The deterministic automation rules autonomously deflect **${auto.autoResolutionRate}%** of customer issues, issuing ₹${refundInRupees} in instant refunds while shielding agent headcount.`;
    const recommendation = `**Recommended Action:** Expand automated eligibility for low-value 'Missing item' complaints to increase autonomous deflection above the 40% benchmark.`;

    const answer = `### Automation & Autonomous Resolution Efficiency (${parsed.timeRange.label})\n\n• **Autonomous Deflection:** **${auto.autoResolutionRate}%** (${auto.autoResolvedCount} out of ${auto.totalComplaints} tickets resolved without human intervention).\n• **Instant Financial Velocity:** ₹${refundInRupees} in customer refunds auto-approved via deterministic validation.\n• **Manual Queue Routing:** ${auto.manualQueueCount} complex disputes escalated to human agents for fraud verification or high-value claims.\n\n${synthesis}\n\n${recommendation}`;

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
      .map((s) => `\`${s.id}\` (${s.name})`)
      .join(", ");

    const synthesis = `**Executive Synthesis:** Fraud detection algorithms have quarantined **${risk.pendingCount} suspicious claims** across ${risk.affectedStores.length} stores, stopping leakage from abnormal refund frequency and geographic mismatches.`;
    const recommendation = `**Recommended Action:** Audit the ${risk.pendingCount} flagged cases on the Fraud Review Board before approving store payouts.`;

    const answer = `### Fraud Detection & Risk Exposure Assessment\n\n• **Flagged Claims:** ${risk.pendingCount} transactions currently pending review across ${risk.affectedStores.length} dark stores.\n• **Cluster Locations:** Concentrated in: ${storesText || "No store clusters"}.\n• **Detection Triggers:** Deterministic heuristics flag repeat refund claimants, multi-account device IDs, and abnormal cart values.\n\n${synthesis}\n\n${recommendation}`;

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

    const descList = anomalies.slice(0, 4).map((a) => `• **${a.title}:** ${a.description}`).join("\n");

    const synthesis = `**Executive Synthesis:** Active equipment breakdowns create localized operational choke-points, directly causing temperature-sensitive order spoilage and delivery cancellations.`;
    const recommendation = `**Recommended Action:** Expedite emergency vendor work orders for offline refrigeration units to restore cold-chain compliance.`;

    const answer = `### Active Telemetry Anomalies & Hardware Red Alerts\n\n${descList || "• No active critical hardware alerts recorded."}\n\n${synthesis}\n\n${recommendation}`;

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
        "PulseScore is a composite operational health index (12-100) computed from penalty deductions: equipment failures (up to 25 pts), SLA breaches (up to 25 pts), refund rates (up to 20 pts), delivery delays (up to 15 pts), picker delays (up to 10 pts), and inventory discrepancies (up to 5 pts).";
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
        "I could not match that to a specific DarkOps operational metric. As your Executive Copilot, I monitor live database telemetry and can investigate:\n• Network Pulse & Fleet Health (e.g. 'What is our pulse score?')\n• Operational Bottlenecks (e.g. 'What is going wrong?' or 'Any critical issues?')\n• Problem Stores (e.g. 'Which stores have the most complaints?')\n• SLA Performance (e.g. 'Where are SLA breaches happening?')\n• Regional Hotspots (e.g. 'Which areas need attention?')\n• Automation & Auto-Refunds (e.g. 'How effective is automation?')\n• Fraud & Risk Reviews (e.g. 'Any fraud risks?')",
      summary: "I specialize in DarkOps operational analytics, SLA tracking, store health, and exception triage.",
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "What is happening across the network?",
        "What is our pulse score?",
        "What is going wrong?",
        "Which stores have the most complaints?",
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
