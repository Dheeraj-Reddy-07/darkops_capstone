import { createSupabaseServiceRoleClient } from "../lib/supabase";

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

interface TimeRange {
  start: Date;
  end: Date;
  label: string;
}

interface ParsedQuery {
  intent: string;
  timeRange: TimeRange;
  comparisonTimeRange?: TimeRange;
  parameters: Record<string, any>;
  entities: string[];
  confidence: number;
}

interface IntentDefinition {
  intent: string;
  phrases: string[];
  keywords: string[];
  negativeKeywords?: string[];
  requiredSignals?: string[];
  optionalSignals?: string[];
  weight: number;
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
  private supabase = createSupabaseServiceRoleClient();

  private intentDefinitions: IntentDefinition[] = [
    {
      intent: "NETWORK_SUMMARY",
      phrases: [
        "what's happening",
        "what is happening",
        "how are we doing",
        "operational summary",
        "what's going on",
        "what is going on",
        "network health",
        "health check",
        "situation today",
        "should i know",
        "biggest issues",
        "what are the biggest operational issues",
        "what are the biggest operational issues right now",
        "biggest operational issues",
        "network status",
        "overall status",
        "quick health check",
        "network operations",
        "overview of network",
        "what's going on right now",
        "network overview",
      ],
      keywords: ["happening", "doing", "summary", "health", "status", "situation", "overview", "network"],
      weight: 1.1,
    },
    {
      intent: "COMPLAINT_TRENDS",
      phrases: [
        "are complaints increasing",
        "are issues going up",
        "what's changed",
        "why are complaints rising",
        "why are issues rising",
        "complaint trends",
        "issue trends",
        "complaint volume",
        "issue volume",
        "spike",
        "increasing",
        "decreasing",
        "trend",
        "compare",
        "versus",
        "vs",
        "better than yesterday",
        "worse than last week",
        "how does this compare",
        "compare complaints this week with last week",
      ],
      keywords: ["trend", "trends", "increasing", "decreasing", "rising", "spike", "spiking", "compare", "versus", "vs", "changed", "change", "difference", "growth"],
      weight: 1.0,
    },
    {
      intent: "COMPLAINT_CATEGORIES",
      phrases: [
        "what are customers complaining about",
        "what's driving complaints",
        "which issue types",
        "main complaint",
        "top categories",
        "complaint categories",
        "issue categories",
        "driving complaints",
        "what types of issues",
        "biggest complaint drivers",
        "breakdown of complaints",
        "which issue types are highest",
      ],
      keywords: ["category", "categories", "type", "types", "complain", "complaining", "complaints", "driving", "driver", "drivers", "main", "reason", "reasons"],
      weight: 1.0,
    },
    {
      intent: "STORE_PERFORMANCE",
      phrases: [
        "which stores have the most complaints",
        "which stores need attention",
        "which stores are driving that",
        "which stores are driving",
        "which stores are driving issues",
        "problem stores",
        "struggling stores",
        "worst stores",
        "dark stores",
        "locations need attention",
        "store performance",
        "bad stores",
        "elevated complaints",
        "high complaint stores",
        "which dark stores are struggling",
        "which locations are performing badly",
        "where are complaints concentrated",
        "unusually high issue volume",
        "show stores with elevated complaints",
        "show problem stores",
        "show me problem stores",
        "top stores",
      ],
      keywords: ["store", "stores", "location", "locations", "darkstore", "darkstores", "outlet", "outlets", "hub", "hubs", "struggling", "problem", "worst", "attention", "badly", "driving"],
      weight: 1.0,
    },
    {
      intent: "CITY_PERFORMANCE",
      phrases: [
        "which cities have the most issues",
        "where are problems concentrated",
        "which cities need attention",
        "city performance",
        "regional performance",
        "cities struggling",
        "problem cities",
        "which regions are struggling",
        "show me city performance",
        "city breakdown",
        "which cities",
        "regional issues",
      ],
      keywords: ["city", "cities", "region", "regional", "regionally", "area", "areas", "zone", "zones"],
      weight: 1.0,
    },
    {
      intent: "SLA_PERFORMANCE",
      phrases: [
        "how many cases are overdue",
        "where are sla breaches",
        "how is support doing",
        "missed sla",
        "sla breaches",
        "sla performance",
        "overdue cases",
        "support performance",
        "how many issues missed sla",
        "which locations have the most sla problems",
        "where are sla breaches happening",
        "sla issues",
      ],
      keywords: ["sla", "breach", "breached", "breaches", "overdue", "late", "support", "deadline", "missed"],
      weight: 1.0,
    },
    {
      intent: "AUTOMATION_PERFORMANCE",
      phrases: [
        "how is automation performing",
        "how much are we resolving automatically",
        "auto-resolved",
        "automation effectiveness",
        "manual work",
        "auto resolution",
        "automation rate",
        "how effective is automation",
        "how many issues are auto-resolved",
        "how much manual work is left",
        "bot resolution",
        "auto resolution percentage",
      ],
      keywords: ["automation", "auto", "resolved", "auto-resolved", "auto-resolution", "manual", "effective", "effectiveness", "rate"],
      weight: 1.0,
    },
    {
      intent: "RISK_SUMMARY",
      phrases: [
        "any fraud risks",
        "suspicious patterns",
        "need review",
        "risk areas",
        "fraud cases",
        "suspicious",
        "fraud risk",
        "what's happening with fraud",
        "fraud overview",
        "suspicious activity",
        "cases pending review",
        "where are the risk areas",
        "are there suspicious patterns",
      ],
      keywords: ["fraud", "risk", "suspicious", "review", "pattern", "patterns", "flagged", "anomalies"],
      weight: 1.0,
    },
    {
      intent: "STORE_DETAIL",
      phrases: [
        "tell me more about",
        "why is",
        "details about",
        "more information",
        "breakdown for",
        "how is",
        "store detail",
        "what is happening at",
        "why is the top store struggling",
        "why is the first one high",
        "what are customers complaining about there",
        "compare it with last week",
        "compare that with last week",
        "what should i investigate first",
      ],
      keywords: ["detail", "breakdown", "store", "why", "more", "first", "second", "top", "there", "investigate"],
      weight: 0.9,
    },
    {
      intent: "GENERAL_DARKOPS_KNOWLEDGE",
      phrases: [
        "what is darkops",
        "what does darkops do",
        "why does darkops exist",
        "how does auto-resolution work",
        "what happens when automation fails",
        "role of executive dashboard",
        "operations dashboard",
        "fraud dashboard",
        "connect with commerce",
        "execute refunds",
        "nlp an llm",
        "is the nlp an llm",
        "does darkops use an llm",
        "is this an ai",
        "is this an llm",
      ],
      keywords: ["darkops", "automation", "dashboard", "refund", "refunds", "nlp", "llm"],
      weight: 0.8,
    },
    {
      intent: "HELP",
      phrases: [
        "what can you do",
        "what can i ask",
        "help",
        "how can you help",
        "capabilities",
        "what questions",
        "how can you help me",
      ],
      keywords: ["help", "capabilities", "questions", "can you"],
      weight: 0.9,
    },
  ];

  private darkOpsKnowledge: Array<{ keywords: string[]; answer: string }> = [
    {
      keywords: ["what is darkops", "explain darkops", "about darkops"],
      answer: "DarkOps is an operational intelligence and exception management platform for quick-commerce dark store operations. It monitors network health, manages complaints, automates resolution, and provides real-time analytics for decision-making.",
    },
    {
      keywords: ["what does darkops do", "function of darkops"],
      answer: "DarkOps provides real-time monitoring of dark store operations, automated complaint classification and routing, SLA tracking, fraud detection, and executive dashboards for network-wide operational intelligence.",
    },
    {
      keywords: ["why does darkops exist", "purpose of darkops"],
      answer: "DarkOps exists to provide operational visibility and exception management for quick-commerce networks, enabling rapid response to issues, automation of routine cases, and data-driven decision making for operations leadership.",
    },
    {
      keywords: ["how does auto-resolution work", "auto resolution work"],
      answer: "Auto-resolution uses deterministic NLP classification to identify simple refund-eligible cases (like missing items) and automatically routes them for processing without manual agent intervention.",
    },
    {
      keywords: ["what happens when automation fails", "automation fails"],
      answer: "When automation cannot confidently classify or resolve a case, it routes to the manual support queue for agent review and decision.",
    },
    {
      keywords: ["role of executive dashboard", "executive dashboard"],
      answer: "The Executive dashboard provides network-wide operational intelligence including PulseScore, SLA compliance, complaint trends, store performance, and risk signals for leadership decision-making.",
    },
    {
      keywords: ["operations dashboard"],
      answer: "The Operations dashboard provides detailed operational views for day-to-day management including active cases, queue management, and store-specific performance metrics.",
    },
    {
      keywords: ["fraud dashboard"],
      answer: "The Fraud dashboard provides risk monitoring and review workflows for suspicious complaint patterns, fraud detection, and investigation management.",
    },
    {
      keywords: ["connect with commerce", "commerce platform"],
      answer: "DarkOps receives complaint data from the commerce platform via API integrations and can send resolution decisions back for automated processing.",
    },
    {
      keywords: ["execute refunds", "does darkops execute refunds", "issue refunds"],
      answer: "DarkOps can recommend and trigger refund decisions through integration with the commerce platform's payment systems for approved cases.",
    },
    {
      keywords: ["nlp an llm", "is the nlp an llm", "use an llm", "using an llm", "is this an llm"],
      answer: "DarkOps uses a deterministic NLP classification engine backed by weighted scoring, exact entity extraction, and database analytics. It does NOT use external LLMs or unexplainable generative AI models.",
    },
  ];

  /**
   * Main entry point - parse question and return analytical response
   */
  async query(question: string, context?: any): Promise<AssistantResponse> {
    const parsed = this.parseQuestion(question, context);

    switch (parsed.intent) {
      case "NETWORK_SUMMARY":
        return this.getNetworkSummary(parsed);
      case "COMPLAINT_TRENDS":
        return this.getComplaintTrends(parsed);
      case "COMPLAINT_CATEGORIES":
        return this.getComplaintCategories(parsed);
      case "STORE_PERFORMANCE":
        return this.getStorePerformance(parsed);
      case "CITY_PERFORMANCE":
        return this.getCityPerformance(parsed);
      case "SLA_PERFORMANCE":
        return this.getSlaPerformance(parsed);
      case "AUTOMATION_PERFORMANCE":
        return this.getAutomationPerformance(parsed);
      case "RISK_SUMMARY":
        return this.getRiskSummary(parsed);
      case "STORE_DETAIL":
        return this.getStoreDetail(parsed);
      case "GENERAL_DARKOPS_KNOWLEDGE":
        return this.getDarkOpsKnowledge(question);
      case "HELP":
        return this.getHelpResponse();
      default:
        return this.getUnsupportedResponse();
    }
  }

  /**
   * Intent detection and parameter extraction
   */
  private parseQuestion(question: string, context?: any): ParsedQuery {
    const q = question.toLowerCase().trim();
    const tokens = this.tokenize(q);

    // Explicit check for out-of-scope queries (weather, sports, general writing)
    if (this.isOutOfScope(q, tokens)) {
      return {
        intent: "UNSUPPORTED",
        timeRange: this.getDefaultTimeRange(),
        parameters: {},
        entities: [],
        confidence: 0,
      };
    }

    // Check for conversational follow-ups using session context
    if (context && (context.lastStore || context.lastCity || (context.lastResults && context.lastResults.length > 0) || context.lastIntent)) {
      const followUp = this.detectFollowUpIntent(q, tokens, context);
      if (followUp) {
        return followUp;
      }
    }

    // Score each intent
    const scoredIntents = this.intentDefinitions.map((def) => ({
      intent: def.intent,
      score: this.calculateIntentScore(q, tokens, def),
    }));

    scoredIntents.sort((a, b) => b.score - a.score);

    const topIntent = scoredIntents[0];
    const confidence = topIntent.score;

    if (confidence < 0.25) {
      return {
        intent: "UNSUPPORTED",
        timeRange: this.getDefaultTimeRange(),
        parameters: {},
        entities: [],
        confidence: 0,
      };
    }

    const timeRange = this.extractTimeRange(q);
    const comparisonTimeRange = this.extractComparisonTimeRange(q, timeRange);
    const entities = this.extractEntities(q, tokens);
    const parameters = this.extractParameters(q, tokens, entities, context);

    return {
      intent: topIntent.intent,
      timeRange,
      comparisonTimeRange,
      parameters,
      entities,
      confidence,
    };
  }

  private isOutOfScope(question: string, tokens: string[]): boolean {
    const outOfScopeTerms = ["weather", "cricket", "recipe", "write an email", "tell a joke", "who won", "football", "movie", "song"];
    return outOfScopeTerms.some((term) => question.includes(term));
  }

  /**
   * Calculate intent score based on phrases, keywords, and signals
   */
  private calculateIntentScore(question: string, tokens: string[], def: IntentDefinition): number {
    let score = 0;

    for (const phrase of def.phrases) {
      if (question.includes(phrase)) {
        score += 0.85;
      }
    }

    for (const keyword of def.keywords) {
      if (tokens.includes(keyword)) {
        score += 0.3;
      }
    }

    if (def.requiredSignals) {
      const hasRequired = def.requiredSignals.every(
        (signal) => tokens.includes(signal) || question.includes(signal)
      );
      if (!hasRequired) {
        score *= 0.1;
      }
    }

    score *= def.weight;
    return Math.min(score, 1.0);
  }

  /**
   * Detect conversational follow-up intent from context
   */
  private detectFollowUpIntent(question: string, tokens: string[], context: any): ParsedQuery | null {
    const q = question.toLowerCase();

    // References like "first one", "first store", "top store", "1st store", "worst store"
    const isFirstRef =
      q.includes("first one") ||
      q.includes("first store") ||
      q.includes("top store") ||
      q.includes("1st store") ||
      q.includes("1st one") ||
      q.includes("worst store") ||
      q.includes("top location");

    const isSecondRef = q.includes("second one") || q.includes("2nd one") || q.includes("2nd store");
    const isThereRef = tokens.includes("there") || q.includes("at that store") || q.includes("for that store");
    const isItRef = tokens.includes("it") || tokens.includes("that") || q.includes("this store");

    const targetStoreId = isSecondRef
      ? context.lastResults?.[1] || context.lastStore
      : isFirstRef
        ? context.lastResults?.[0] || context.lastStore
        : context.lastStore || context.lastResults?.[0];

    // Follow-up: "Which stores are driving that?" after Network Summary or Complaint Categories
    if ((q.includes("which stores are driving") || q.includes("which stores")) && (context.lastIntent === "NETWORK_SUMMARY" || context.lastIntent === "COMPLAINT_CATEGORIES")) {
      return {
        intent: "STORE_PERFORMANCE",
        timeRange: this.extractTimeRange(q),
        parameters: { city: context.lastCity },
        entities: context.lastCity ? [context.lastCity] : [],
        confidence: 0.95,
      };
    }

    // Follow-up: "Why is the top store struggling?" or "Why is the first one high?"
    if (isFirstRef || isSecondRef || (isItRef && q.includes("why"))) {
      if (targetStoreId) {
        return {
          intent: "STORE_DETAIL",
          timeRange: this.extractTimeRange(q),
          comparisonTimeRange: this.extractComparisonTimeRange(q, this.extractTimeRange(q)),
          parameters: { storeId: targetStoreId, followUpType: "why" },
          entities: [targetStoreId],
          confidence: 0.95,
        };
      }
    }

    // Follow-up: "What are customers complaining about there?"
    if (isThereRef || (isItRef && (q.includes("complaining") || q.includes("complaint")))) {
      if (targetStoreId) {
        return {
          intent: "COMPLAINT_CATEGORIES",
          timeRange: this.extractTimeRange(q),
          parameters: { storeId: targetStoreId },
          entities: [targetStoreId],
          confidence: 0.9,
        };
      }
    }

    // Follow-up: "Compare it with last week" or "Compare that with last week"
    if ((isItRef || isThereRef || q.includes("compare")) && (q.includes("last week") || q.includes("yesterday") || q.includes("vs"))) {
      const timeRange = this.getDefaultTimeRange();
      const compRange = this.extractTimeRange(q.includes("last week") ? "last week" : q);
      return {
        intent: "STORE_DETAIL",
        timeRange,
        comparisonTimeRange: compRange,
        parameters: { storeId: targetStoreId, compare: true },
        entities: targetStoreId ? [targetStoreId] : [],
        confidence: 0.92,
      };
    }

    // Follow-up: "What should I investigate first?"
    if (q.includes("investigate first") || q.includes("what should i investigate") || q.includes("action item")) {
      return {
        intent: "STORE_DETAIL",
        timeRange: this.getDefaultTimeRange(),
        parameters: { storeId: targetStoreId, recommendation: true },
        entities: targetStoreId ? [targetStoreId] : [],
        confidence: 0.9,
      };
    }

    return null;
  }

  private tokenize(question: string): string[] {
    return question
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }

  private extractTimeRange(question: string): TimeRange {
    const now = new Date();
    const q = question.toLowerCase();

    if (q.includes("today")) {
      return {
        start: new Date(now.setHours(0, 0, 0, 0)),
        end: new Date(),
        label: "today",
      };
    }

    if (q.includes("yesterday")) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: new Date(yesterday.setHours(0, 0, 0, 0)),
        end: new Date(yesterday.setHours(23, 59, 59, 999)),
        label: "yesterday",
      };
    }

    if (q.includes("last 24 hours") || q.includes("24h") || q.includes("24 hours")) {
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: new Date(),
        label: "last 24 hours",
      };
    }

    if (q.includes("this week") || q.includes("last 7 days") || q.includes("7d") || q.includes("7 days")) {
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: new Date(),
        label: "last 7 days",
      };
    }

    if (q.includes("last week")) {
      const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const lastWeekEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return {
        start: new Date(lastWeekStart.setHours(0, 0, 0, 0)),
        end: new Date(lastWeekEnd.setHours(23, 59, 59, 999)),
        label: "last week",
      };
    }

    if (q.includes("this month") || q.includes("last 30 days") || q.includes("30d") || q.includes("30 days")) {
      return {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: new Date(),
        label: "last 30 days",
      };
    }

    if (q.includes("last month")) {
      const lastMonthStart = new Date(now);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      lastMonthStart.setDate(1);
      const lastMonthEnd = new Date(now);
      lastMonthEnd.setDate(0);
      return {
        start: new Date(lastMonthStart.setHours(0, 0, 0, 0)),
        end: new Date(lastMonthEnd.setHours(23, 59, 59, 999)),
        label: "last month",
      };
    }

    return this.getDefaultTimeRange();
  }

  private extractComparisonTimeRange(question: string, currentRange: TimeRange): TimeRange | undefined {
    const q = question.toLowerCase();
    const periodLength = currentRange.end.getTime() - currentRange.start.getTime();

    if (q.includes("compare") || q.includes("versus") || q.includes("vs") || q.includes("changed") || q.includes("difference")) {
      if (q.includes("yesterday")) {
        const yesterday = new Date(currentRange.start);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          start: new Date(yesterday.setHours(0, 0, 0, 0)),
          end: new Date(yesterday.setHours(23, 59, 59, 999)),
          label: "yesterday",
        };
      }

      const prevStart = new Date(currentRange.start.getTime() - periodLength);
      const prevEnd = new Date(currentRange.end.getTime() - periodLength);
      return {
        start: prevStart,
        end: prevEnd,
        label: "previous period",
      };
    }

    return undefined;
  }

  private getDefaultTimeRange(): TimeRange {
    const now = new Date();
    return {
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
      label: "last 7 days",
    };
  }

  private extractEntities(question: string, tokens: string[]): string[] {
    const entities: string[] = [];

    // Store ID patterns like DS-1462, HYD-042, BLR-021, MUM-001, etc.
    const storePattern = /\b[A-Z]{2,3}-\d{3,4}\b/gi;
    const storeMatches = question.match(storePattern);
    if (storeMatches) {
      entities.push(...storeMatches.map((s) => s.toUpperCase()));
    }

    const cities = ["hyderabad", "bengaluru", "bangalore", "mumbai", "delhi", "chennai", "kolkata", "pune", "ahmedabad", "jaipur"];
    for (const city of cities) {
      if (tokens.includes(city) || question.toLowerCase().includes(city)) {
        const normalizedCity = city === "bangalore" ? "Bengaluru" : city.charAt(0).toUpperCase() + city.slice(1);
        if (!entities.includes(normalizedCity)) {
          entities.push(normalizedCity);
        }
      }
    }

    return entities;
  }

  private extractParameters(question: string, tokens: string[], entities: string[], context?: any): Record<string, any> {
    const parameters: Record<string, any> = {};

    if (tokens.includes("highest") || tokens.includes("top") || tokens.includes("most") || tokens.includes("worst")) {
      parameters.direction = "desc";
      parameters.limit = 5;
    } else if (tokens.includes("lowest") || tokens.includes("least") || tokens.includes("best")) {
      parameters.direction = "asc";
      parameters.limit = 5;
    }

    const cityEntity = entities.find((e) => !e.match(/^[A-Z]{2,3}-\d{3,4}$/));
    if (cityEntity) {
      parameters.city = cityEntity;
    } else if (context?.lastCity) {
      parameters.city = context.lastCity;
    }

    const storeEntity = entities.find((e) => e.match(/^[A-Z]{2,3}-\d{3,4}$/));
    if (storeEntity) {
      parameters.storeId = storeEntity;
    }

    return parameters;
  }

  /**
   * NETWORK_SUMMARY: Overall operational summary
   */
  private async getNetworkSummary(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;

    const [
      { count: totalComplaints },
      { count: resolvedCount },
      { count: activeQueue },
      { count: slaBreached },
      { data: pulseData },
      { count: fraudReview },
      { data: categoryData },
      { data: storeData },
    ] = await Promise.all([
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .in("status", ["unassigned", "assigned", "in_progress", "escalated_l2"]),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("sla_state", "breached"),
      this.supabase.from("pulse_scores").select("score"),
      this.supabase
        .from("fraud_reviews")
        .select("*", { count: "exact", head: true })
        .eq("decision", "pending_review"),
      this.supabase
        .from("complaints")
        .select("category")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      this.supabase
        .from("complaints")
        .select("store_id, stores!inner(id, name, city)")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
    ]);

    const totalComplaintsValue = totalComplaints || 0;
    if (totalComplaintsValue === 0) {
      return this.getEmptyDataResponse(parsed.timeRange.label);
    }

    // Auto-resolved count: resolved complaints with assigned_agent_id IS NULL
    const { count: autoResolvedCount } = await this.supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved")
      .is("assigned_agent_id", null)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const autoResolved = autoResolvedCount || 0;
    const avgPulse =
      pulseData && pulseData.length > 0
        ? Math.round(pulseData.reduce((sum, p) => sum + p.score, 0) / pulseData.length)
        : 0;

    const categoryMap = new Map<string, number>();
    categoryData?.forEach((c: any) => {
      const cat = c.category || "other";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    const topCategoryEntry = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const topCategoryLabel = topCategoryEntry ? CATEGORY_LABEL_MAP[topCategoryEntry[0]] || topCategoryEntry[0] : "None";

    const storeMap = new Map<string, { id: string; name: string; city: string; count: number }>();
    storeData?.forEach((c: any) => {
      const store = c.stores;
      if (store) {
        const existing = storeMap.get(c.store_id) || { id: store.id, name: store.name, city: store.city, count: 0 };
        existing.count++;
        storeMap.set(c.store_id, existing);
      }
    });

    const topStoresList = Array.from(storeMap.values()).sort((a, b) => b.count - a.count);
    const topStore = topStoresList[0];
    const topStoreIds = topStoresList.slice(0, 3).map((s) => s.id);

    const activeQueueValue = activeQueue || 0;
    const slaBreachedValue = slaBreached || 0;
    const fraudReviewValue = fraudReview || 0;

    const answer = `Network overview for ${parsed.timeRange.label}: We are tracking ${totalComplaintsValue} total issues across the network. Currently, ${activeQueueValue} cases are in the active support queue and ${slaBreachedValue} cases have breached SLA.${
      topCategoryEntry ? ` ${topCategoryLabel} represents the top complaint category (${topCategoryEntry[1]} cases).` : ""
    }${topStore ? ` ${topStore.name} (${topStore.city}) recorded the highest complaint volume (${topStore.count} cases).` : ""}${
      fraudReviewValue > 0 ? ` ${fraudReviewValue} cases are currently flagged for fraud review.` : ""
    }`;

    return {
      intent: "NETWORK_SUMMARY",
      answer,
      summary: `${totalComplaintsValue} total complaints - ${activeQueueValue} active - ${slaBreachedValue} SLA breaches`,
      metrics: [
        { label: "Total complaints", value: String(totalComplaintsValue), tone: totalComplaintsValue > 50 ? "warn" : "neutral" },
        { label: "Resolved", value: String(resolvedCount || 0), tone: "ok" },
        { label: "Auto-resolved", value: String(autoResolved), tone: "ok" },
        { label: "Active queue", value: String(activeQueueValue), tone: activeQueueValue > 20 ? "crit" : "warn" },
        { label: "SLA breaches", value: String(slaBreachedValue), tone: slaBreachedValue > 5 ? "crit" : "warn" },
        { label: "Fraud review", value: String(fraudReviewValue), tone: fraudReviewValue > 3 ? "warn" : "neutral" },
        { label: "Network PulseScore", value: `${avgPulse}/100`, tone: avgPulse < 60 ? "crit" : avgPulse < 80 ? "warn" : "ok" },
      ],
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Total issues", value: String(totalComplaintsValue) },
        { label: "Active support cases", value: String(activeQueueValue) },
        { label: "SLA breaches", value: String(slaBreachedValue) },
        { label: "Top category", value: topCategoryLabel },
      ],
      suggestedQuestions: [
        "Which stores have the most complaints?",
        "What are the top complaint categories?",
        "Are complaints increasing?",
        "How effective is automation?",
      ],
      context: {
        lastIntent: "NETWORK_SUMMARY",
        lastStore: topStore?.id,
        lastCity: topStore?.city,
        lastCategory: topCategoryEntry?.[0],
        lastTimePeriod: parsed.timeRange.label,
        lastResults: topStoreIds,
      },
    };
  }

  /**
   * COMPLAINT_TRENDS: Analyze complaint volume changes
   */
  private async getComplaintTrends(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;
    const periodLength = end.getTime() - start.getTime();
    const comparisonStart = parsed.comparisonTimeRange?.start || new Date(start.getTime() - periodLength);
    const comparisonEnd = parsed.comparisonTimeRange?.end || new Date(start.getTime() - 1);

    const [{ count: currentCount }, { count: prevCount }, { data: currentCategories }] = await Promise.all([
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .gte("created_at", comparisonStart.toISOString())
        .lte("created_at", comparisonEnd.toISOString()),
      this.supabase
        .from("complaints")
        .select("category")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
    ]);

    const current = currentCount || 0;
    const previous = prevCount || 0;

    if (current === 0 && previous === 0) {
      return this.getEmptyDataResponse(parsed.timeRange.label);
    }

    const diff = current - previous;
    const pctChange = previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0;
    const isIncreasing = diff > 0;

    const categoryMap = new Map<string, number>();
    currentCategories?.forEach((c: any) => {
      const cat = c.category || "other";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });
    const topCategoryEntry = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1])[0];
    const topCategoryLabel = topCategoryEntry ? CATEGORY_LABEL_MAP[topCategoryEntry[0]] || topCategoryEntry[0] : "None";

    let answer = "";
    if (previous === 0) {
      answer = `Complaint volume for ${parsed.timeRange.label} stands at ${current} cases.`;
    } else if (diff === 0) {
      answer = `Complaint volume remained stable at ${current} cases compared to the previous period.`;
    } else {
      answer = `Complaint volume is ${Math.abs(pctChange)}% ${isIncreasing ? "higher" : "lower"} than the previous period (${previous} cases previously vs ${current} cases now).`;
    }

    if (topCategoryEntry) {
      answer += ` ${topCategoryLabel} issues account for the largest share of overall complaints (${topCategoryEntry[1]} cases).`;
    }

    return {
      intent: "COMPLAINT_TRENDS",
      answer,
      summary: `${current} complaints - ${pctChange >= 0 ? "+" : ""}${pctChange}% vs previous period`,
      metrics: [
        { label: "Current period", value: String(current), tone: current > 50 ? "warn" : "neutral" },
        { label: "Previous period", value: String(previous), tone: "neutral" },
        { label: "Absolute change", value: `${diff >= 0 ? "+" : ""}${diff}`, tone: diff > 0 ? "crit" : "ok" },
        { label: "Percentage change", value: `${pctChange >= 0 ? "+" : ""}${pctChange}%`, tone: pctChange > 0 ? "crit" : "ok" },
      ],
      evidence: [
        { label: "Current period", value: parsed.timeRange.label },
        { label: "Current volume", value: String(current) },
        { label: "Previous volume", value: String(previous) },
        { label: "Percentage change", value: `${pctChange}%` },
      ],
      suggestedQuestions: [
        "Which stores are driving the increase?",
        "What categories are driving it?",
        "Compare with last week",
      ],
      context: {
        lastIntent: "COMPLAINT_TRENDS",
        lastCategory: topCategoryEntry?.[0],
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * COMPLAINT_CATEGORIES: Ranked complaint categories
   */
  private async getComplaintCategories(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;
    const { storeId, city } = parsed.parameters;

    let query = this.supabase
      .from("complaints")
      .select("category, store_id, stores!inner(name, city)")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (storeId) {
      query = query.eq("store_id", storeId);
    } else if (city) {
      query = query.ilike("stores.city", `%${city}%`);
    }

    const { data: categoryData } = await query;

    const categoryMap = new Map<string, number>();
    categoryData?.forEach((c: any) => {
      const cat = c.category || "other";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });

    const total = Array.from(categoryMap.values()).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return this.getEmptyDataResponse(parsed.timeRange.label);
    }

    const sortedCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
    const scopeLabel = storeId ? `for store ${storeId}` : city ? `in ${city}` : `across the network`;

    const topList = sortedCategories
      .slice(0, 4)
      .map(([cat, count]) => `${CATEGORY_LABEL_MAP[cat] || cat} (${count} cases, ${Math.round((count / total) * 100)}%)`)
      .join(", ");

    const answer = `Complaint breakdown ${scopeLabel} for ${parsed.timeRange.label}: The primary issue types are ${topList}. Total complaints analyzed: ${total}.`;

    return {
      intent: "COMPLAINT_CATEGORIES",
      answer,
      summary: `${sortedCategories.length} categories - ${total} total complaints`,
      metrics: sortedCategories.slice(0, 5).map(([cat, count]) => ({
        label: CATEGORY_LABEL_MAP[cat] || cat,
        value: `${count} (${total > 0 ? Math.round((count / total) * 100) : 0}%)`,
        tone: count > total * 0.3 ? "warn" : "neutral",
      })),
      evidence: [
        { label: "Scope", value: scopeLabel },
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Total complaints", value: String(total) },
        { label: "Top category", value: CATEGORY_LABEL_MAP[sortedCategories[0]?.[0]] || sortedCategories[0]?.[0] || "None" },
      ],
      suggestedQuestions: [
        "Which stores have the most complaints?",
        "Are complaints increasing?",
        "How effective is automation?",
      ],
      context: {
        lastIntent: "COMPLAINT_CATEGORIES",
        lastStore: storeId,
        lastCity: city,
        lastCategory: sortedCategories[0]?.[0],
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * STORE_PERFORMANCE: Worst performing stores
   */
  private async getStorePerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;
    const { city, storeId } = parsed.parameters;

    if (storeId) {
      return this.getStoreDetail({
        intent: "STORE_DETAIL",
        timeRange: parsed.timeRange,
        parameters: { storeId },
        entities: [storeId],
        confidence: 0.95,
      });
    }

    let complaintQuery = this.supabase
      .from("complaints")
      .select("store_id, category, stores!inner(id, name, city)")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (city) {
      complaintQuery = complaintQuery.ilike("stores.city", `%${city}%`);
    }

    const [{ data: complaintData }, { data: orderData }, { data: pulseData }] = await Promise.all([
      complaintQuery,
      this.supabase.from("orders").select("store_id"),
      this.supabase.from("pulse_scores").select("store_id, score"),
    ]);

    const complaintMap = new Map<string, { name: string; city: string; count: number; categories: Map<string, number> }>();
    complaintData?.forEach((c: any) => {
      const store = c.stores;
      if (store) {
        const existing = complaintMap.get(c.store_id) || {
          name: store.name,
          city: store.city,
          count: 0,
          categories: new Map<string, number>(),
        };
        existing.count++;
        const cat = c.category || "other";
        existing.categories.set(cat, (existing.categories.get(cat) || 0) + 1);
        complaintMap.set(c.store_id, existing);
      }
    });

    if (complaintMap.size === 0) {
      return this.getEmptyDataResponse(parsed.timeRange.label);
    }

    const orderMap = new Map<string, number>();
    orderData?.forEach((o: any) => {
      orderMap.set(o.store_id, (orderMap.get(o.store_id) || 0) + 1);
    });

    const pulseMap = new Map<string, number>();
    pulseData?.forEach((p: any) => {
      pulseMap.set(p.store_id, p.score);
    });

    const storePerformance = Array.from(complaintMap.entries()).map(([sId, info]) => {
      const orders = orderMap.get(sId) || 0;
      const complaintRate = orders > 0 ? (info.count / orders) * 100 : null;
      const topCatEntry = Array.from(info.categories.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        storeId: sId,
        name: info.name,
        city: info.city,
        complaintCount: info.count,
        orders,
        complaintRate: complaintRate !== null ? Number(complaintRate.toFixed(2)) : null,
        pulse: pulseMap.get(sId) || 0,
        dominantCategory: topCatEntry ? CATEGORY_LABEL_MAP[topCatEntry[0]] || topCatEntry[0] : "General",
      };
    });

    const worstStores = storePerformance
      .sort((a, b) => b.complaintCount - a.complaintCount)
      .slice(0, 5);

    const storeIds = worstStores.map((s) => s.storeId);
    const scopeLabel = city ? `in ${city}` : "across the network";

    const worstStoreSummary = worstStores
      .map((s) => `${s.storeId} (${s.name}) — ${s.complaintCount} complaints${s.complaintRate !== null ? ` (${s.complaintRate}% complaint rate)` : ""}`)
      .join("; ");

    const answer = `Top problem stores by complaint volume ${scopeLabel} for ${parsed.timeRange.label}: ${worstStoreSummary}. ${worstStores[0].name} has the highest issue volume (${worstStores[0].complaintCount} complaints), driven primarily by ${worstStores[0].dominantCategory}.`;

    return {
      intent: "STORE_PERFORMANCE",
      answer,
      summary: `${worstStores.length} locations identified - Top: ${worstStores[0]?.storeId} (${worstStores[0]?.name})`,
      metrics: worstStores.map((s) => ({
        label: `${s.storeId} - ${s.name}`,
        value: s.complaintRate !== null ? `${s.complaintCount} issues (${s.complaintRate}%)` : `${s.complaintCount} complaints`,
        tone: s.complaintCount > 15 ? "crit" : s.complaintCount > 5 ? "warn" : "neutral",
      })),
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Locations analyzed", value: String(storePerformance.length) },
        { label: "Top problem store", value: `${worstStores[0]?.storeId} (${worstStores[0]?.name})` },
        { label: "Dominant issue", value: worstStores[0]?.dominantCategory || "N/A" },
      ],
      suggestedQuestions: [
        `Why is ${worstStores[0]?.storeId} struggling?`,
        `What are customers complaining about there?`,
        `Compare ${worstStores[0]?.storeId} with last week`,
      ],
      drillDown: {
        label: `View ${worstStores[0]?.storeId} details`,
        route: "/dark-stores/$id",
        params: { id: worstStores[0]?.storeId },
      },
      context: {
        lastIntent: "STORE_PERFORMANCE",
        lastStore: worstStores[0]?.storeId,
        lastCity: worstStores[0]?.city,
        lastResults: storeIds,
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * CITY_PERFORMANCE: Performance by city/region
   */
  private async getCityPerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;

    const { data: complaintData } = await this.supabase
      .from("complaints")
      .select("category, store_id, stores!inner(city)")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const cityMap = new Map<string, { count: number; categories: Map<string, number> }>();
    complaintData?.forEach((c: any) => {
      const city = c.stores?.city || "Unknown";
      const existing = cityMap.get(city) || { count: 0, categories: new Map<string, number>() };
      existing.count++;
      const cat = c.category || "other";
      existing.categories.set(cat, (existing.categories.get(cat) || 0) + 1);
      cityMap.set(city, existing);
    });

    if (cityMap.size === 0) {
      return this.getEmptyDataResponse(parsed.timeRange.label);
    }

    const cityPerformance = Array.from(cityMap.entries())
      .map(([cityName, info]) => {
        const topCatEntry = Array.from(info.categories.entries()).sort((a, b) => b[1] - a[1])[0];
        return {
          city: cityName,
          count: info.count,
          dominantCategory: topCatEntry ? CATEGORY_LABEL_MAP[topCatEntry[0]] || topCatEntry[0] : "General",
        };
      })
      .sort((a, b) => b.count - a.count);

    const totalNetworkComplaints = cityPerformance.reduce((sum, c) => sum + c.count, 0);
    const topCity = cityPerformance[0];

    const cityList = cityPerformance
      .slice(0, 4)
      .map((c) => `${c.city}: ${c.count} complaints (${Math.round((c.count / totalNetworkComplaints) * 100)}%)`)
      .join(", ");

    const answer = `City operational performance for ${parsed.timeRange.label}: Problems are concentrated in ${cityList}. ${topCity.city} leads network complaint volume (${topCity.count} cases), with ${topCity.dominantCategory} representing the largest category.`;

    return {
      intent: "CITY_PERFORMANCE",
      answer,
      summary: `${cityPerformance.length} cities tracked - Highest: ${topCity.city}`,
      metrics: cityPerformance.map((c) => ({
        label: c.city,
        value: `${c.count} complaints`,
        tone: c.count > 20 ? "crit" : c.count > 10 ? "warn" : "neutral",
      })),
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Cities analyzed", value: String(cityMap.size) },
        { label: "Top problem city", value: topCity.city },
        { label: "City issue volume", value: String(topCity.count) },
      ],
      suggestedQuestions: [
        `Which stores in ${topCity.city} have the most complaints?`,
        "What are the top complaint categories?",
        "Are complaints increasing?",
      ],
      context: {
        lastIntent: "CITY_PERFORMANCE",
        lastCity: topCity.city,
        lastTimePeriod: parsed.timeRange.label,
      },
    };
  }

  /**
   * SLA_PERFORMANCE: SLA breaches and support performance
   */
  private async getSlaPerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const [{ count: activeCases }, { count: slaBreached }, { data: breachData }] = await Promise.all([
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .in("status", ["unassigned", "assigned", "in_progress", "escalated_l2"]),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("sla_state", "breached"),
      this.supabase
        .from("complaints")
        .select("store_id, stores!inner(id, name, city), created_at")
        .eq("sla_state", "breached")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const activeCasesValue = activeCases || 0;
    const slaBreachedValue = slaBreached || 0;

    const breachStoreMap = new Map<string, { id: string; name: string; city: string; count: number }>();
    breachData?.forEach((c: any) => {
      const store = c.stores;
      if (store) {
        const existing = breachStoreMap.get(c.store_id) || { id: store.id, name: store.name, city: store.city, count: 0 };
        existing.count++;
        breachStoreMap.set(c.store_id, existing);
      }
    });

    const affectedStores = Array.from(breachStoreMap.values()).sort((a, b) => b.count - a.count);
    const breachRate = activeCasesValue > 0 ? Math.round((slaBreachedValue / activeCasesValue) * 100) : 0;

    let answer = `SLA performance overview: There are currently ${activeCasesValue} active support cases across the network. ${slaBreachedValue} cases have breached SLA deadline (${breachRate}% breach rate).`;

    if (affectedStores.length > 0) {
      answer += ` SLA breaches are most prevalent at: ${affectedStores.map((s) => `${s.id} (${s.name})`).slice(0, 3).join(", ")}.`;
    }

    return {
      intent: "SLA_PERFORMANCE",
      answer,
      summary: `${slaBreachedValue} SLA breaches - ${activeCasesValue} active support cases`,
      metrics: [
        { label: "Active support queue", value: String(activeCasesValue), tone: activeCasesValue > 20 ? "crit" : "warn" },
        { label: "SLA breached cases", value: String(slaBreachedValue), tone: slaBreachedValue > 5 ? "crit" : "warn" },
        { label: "SLA breach rate", value: `${breachRate}%`, tone: breachRate > 20 ? "crit" : "warn" },
        { label: "Affected stores", value: String(breachStoreMap.size), tone: breachStoreMap.size > 3 ? "warn" : "neutral" },
      ],
      evidence: [
        { label: "Active queue", value: String(activeCasesValue) },
        { label: "SLA breaches", value: String(slaBreachedValue) },
        { label: "Breach percentage", value: `${breachRate}%` },
        { label: "Affected locations", value: String(breachStoreMap.size) },
      ],
      suggestedQuestions: [
        "Which stores have the most SLA breaches?",
        "How effective is automation?",
        "What are the top complaint categories?",
      ],
      drillDown: { label: "View Operations Dashboard", route: "/operations" },
      context: {
        lastIntent: "SLA_PERFORMANCE",
        lastStore: affectedStores[0]?.id,
        lastResults: affectedStores.map((s) => s.id),
      },
    };
  }

  /**
   * AUTOMATION_PERFORMANCE: Auto-resolution effectiveness
   */
  private async getAutomationPerformance(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;

    const [{ count: totalComplaints }, { count: resolvedCount }, { count: activeQueue }, { count: autoResolvedCount }] = await Promise.all([
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .in("status", ["unassigned", "assigned", "in_progress", "escalated_l2"]),
      this.supabase
        .from("complaints")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved")
        .is("assigned_agent_id", null)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString()),
    ]);

    const total = totalComplaints || 0;
    if (total === 0) {
      return this.getEmptyDataResponse(parsed.timeRange.label);
    }

    const autoResolved = autoResolvedCount || 0;
    const manualQueue = activeQueue || 0;
    const autoRate = Math.round((autoResolved / total) * 100);

    const answer = `Automation performance for ${parsed.timeRange.label}: Out of ${total} processed issues, ${autoResolved} cases (${autoRate}%) were auto-resolved without agent intervention. ${manualQueue} cases are routed to the manual support queue.`;

    return {
      intent: "AUTOMATION_PERFORMANCE",
      answer,
      summary: `${autoRate}% auto-resolution rate - ${autoResolved} auto-resolved cases`,
      metrics: [
        { label: "Total issues processed", value: String(total), tone: "neutral" },
        { label: "Auto-resolved cases", value: String(autoResolved), tone: "ok" },
        { label: "Manual support queue", value: String(manualQueue), tone: manualQueue > 20 ? "warn" : "neutral" },
        { label: "Auto-resolution rate", value: `${autoRate}%`, tone: autoRate > 40 ? "ok" : "warn" },
      ],
      evidence: [
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Total processed", value: String(total) },
        { label: "Auto-resolved", value: String(autoResolved) },
        { label: "Manual queue", value: String(manualQueue) },
      ],
      suggestedQuestions: [
        "What are the top complaint categories?",
        "Which stores need attention?",
        "Where are SLA breaches happening?",
      ],
      context: { lastIntent: "AUTOMATION_PERFORMANCE", lastTimePeriod: parsed.timeRange.label },
    };
  }

  /**
   * RISK_SUMMARY: Fraud and risk signals
   */
  private async getRiskSummary(parsed: ParsedQuery): Promise<AssistantResponse> {
    const [{ count: pendingReview }, { data: fraudData }] = await Promise.all([
      this.supabase
        .from("fraud_reviews")
        .select("*", { count: "exact", head: true })
        .eq("decision", "pending_review"),
      this.supabase
        .from("fraud_reviews")
        .select("complaint_id, complaints!inner(store_id, stores!inner(id, name, city))")
        .eq("decision", "pending_review")
        .limit(20),
    ]);

    const pendingCount = pendingReview || 0;
    const storeMap = new Map<string, { id: string; name: string; city: string; count: number }>();
    fraudData?.forEach((f: any) => {
      const store = f.complaints?.stores;
      if (store) {
        const existing = storeMap.get(f.complaints.store_id) || { id: store.id, name: store.name, city: store.city, count: 0 };
        existing.count++;
        storeMap.set(f.complaints.store_id, existing);
      }
    });

    const affectedStores = Array.from(storeMap.values()).sort((a, b) => b.count - a.count);

    let answer = `Risk & fraud overview: ${pendingCount} cases are currently flagged for fraud review across ${affectedStores.length} dark stores.`;
    if (affectedStores.length > 0) {
      answer += ` Flagged cases are concentrated in: ${affectedStores.map((s) => `${s.id} (${s.name})`).slice(0, 3).join(", ")}.`;
    }

    return {
      intent: "RISK_SUMMARY",
      answer,
      summary: `${pendingCount} cases pending fraud review - ${affectedStores.length} stores affected`,
      metrics: [
        { label: "Pending risk reviews", value: String(pendingCount), tone: pendingCount > 5 ? "crit" : "warn" },
        { label: "Affected stores", value: String(affectedStores.length), tone: affectedStores.length > 3 ? "warn" : "neutral" },
      ],
      evidence: [
        { label: "Flagged review cases", value: String(pendingCount) },
        { label: "Affected stores", value: String(affectedStores.length) },
      ],
      suggestedQuestions: [
        "Which stores have the most complaints?",
        "What are the top complaint categories?",
        "How effective is automation?",
      ],
      drillDown: { label: "View Fraud Dashboard", route: "/fraud" },
      context: {
        lastIntent: "RISK_SUMMARY",
        lastStore: affectedStores[0]?.id,
        lastResults: affectedStores.map((s) => s.id),
      },
    };
  }

  /**
   * STORE_DETAIL: Specific store operational breakdown
   */
  private async getStoreDetail(parsed: ParsedQuery): Promise<AssistantResponse> {
    const { start, end } = parsed.timeRange;
    const { storeId, recommendation } = parsed.parameters;

    if (!storeId) {
      return {
        intent: "STORE_DETAIL",
        answer: "Please specify a store ID (e.g. HYD-042 or DS-1462) to analyze detailed performance.",
        summary: "Store ID required",
        metrics: [],
        evidence: [],
        suggestedQuestions: ["Which stores have the most complaints?", "What are the top complaint categories?"],
      };
    }

    const periodLength = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodLength);
    const prevEnd = new Date(start.getTime() - 1);

    const [
      { data: storeData },
      { data: complaintData },
      { count: prevComplaintCount },
      { data: pulseData },
      { count: orderCount },
    ] = await Promise.all([
      this.supabase.from("stores").select("id, name, city, zone, pickers_on_shift, riders_assigned").eq("id", storeId).maybeSingle(),
      this.supabase.from("complaints").select("id, category, status, sla_state, created_at").eq("store_id", storeId).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      this.supabase.from("complaints").select("*", { count: "exact", head: true }).eq("store_id", storeId).gte("created_at", prevStart.toISOString()).lte("created_at", prevEnd.toISOString()),
      this.supabase.from("pulse_scores").select("score").eq("store_id", storeId).maybeSingle(),
      this.supabase.from("orders").select("*", { count: "exact", head: true }).eq("store_id", storeId),
    ]);

    if (!storeData) {
      return {
        intent: "STORE_DETAIL",
        answer: `Store ID ${storeId} was not found in the DarkOps database.`,
        summary: "Store not found",
        metrics: [],
        evidence: [],
        suggestedQuestions: ["Which stores have the most complaints?", "Show me problem stores"],
      };
    }

    const complaintsCount = complaintData?.length || 0;
    const prevComplaints = prevComplaintCount || 0;
    const ordersCount = orderCount || 0;
    const complaintRate = ordersCount > 0 ? Number(((complaintsCount / ordersCount) * 100).toFixed(2)) : null;
    const slaBreached = complaintData?.filter((c: any) => c.sla_state === "breached").length || 0;
    const currentPulse = pulseData?.score || 0;

    const categoryMap = new Map<string, number>();
    complaintData?.forEach((c: any) => {
      const cat = c.category || "other";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    });

    const topCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
    const topCategoryLabel = topCategories[0] ? CATEGORY_LABEL_MAP[topCategories[0][0]] || topCategories[0][0] : "General";

    let answer = `${storeData.id} (${storeData.name}, ${storeData.city}) has recorded ${complaintsCount} complaints for ${parsed.timeRange.label}${complaintRate !== null ? ` (${complaintRate}% complaint rate across ${ordersCount} orders)` : ""}. ${topCategoryLabel} represents the largest issue category (${topCategories[0]?.[1] || 0} cases).`;

    if (slaBreached > 0) {
      answer += ` ${slaBreached} cases have breached SLA.`;
    }

    if (prevComplaints > 0) {
      const pctDiff = Math.round(((complaintsCount - prevComplaints) / prevComplaints) * 100);
      answer += ` Volume is ${Math.abs(pctDiff)}% ${pctDiff >= 0 ? "higher" : "lower"} than the previous period (${prevComplaints} cases).`;
    }

    if (recommendation || parsed.parameters.followUpType === "why") {
      answer += ` Recommended next step: Inspect picking and packing workflows at ${storeData.id} in the Operations dashboard and reassign support resources to clear the ${slaBreached} SLA-breached cases.`;
    }

    return {
      intent: "STORE_DETAIL",
      answer,
      summary: `${storeData.id} (${storeData.name}) - ${complaintsCount} complaints - PulseScore ${currentPulse}`,
      metrics: [
        { label: "Complaint volume", value: String(complaintsCount), tone: complaintsCount > 10 ? "crit" : "warn" },
        { label: "Complaint rate", value: complaintRate !== null ? `${complaintRate}%` : "N/A", tone: "neutral" },
        { label: "SLA breaches", value: String(slaBreached), tone: slaBreached > 2 ? "crit" : "warn" },
        { label: "Store PulseScore", value: `${currentPulse}/100`, tone: currentPulse < 60 ? "crit" : currentPulse < 80 ? "warn" : "ok" },
      ],
      evidence: [
        { label: "Store ID & Name", value: `${storeData.id} — ${storeData.name}` },
        { label: "Location", value: storeData.city },
        { label: "Time period", value: parsed.timeRange.label },
        { label: "Dominant category", value: topCategoryLabel },
        { label: "SLA breaches", value: String(slaBreached) },
      ],
      suggestedQuestions: [
        `What are customers complaining about at ${storeData.id}?`,
        `Compare ${storeData.id} with last week`,
        "Which other stores need attention?",
      ],
      drillDown: {
        label: `View ${storeData.id} in Dark Stores`,
        route: "/dark-stores/$id",
        params: { id: storeData.id },
      },
      context: {
        lastIntent: "STORE_DETAIL",
        lastStore: storeData.id,
        lastCity: storeData.city,
        lastCategory: topCategories[0]?.[0],
        lastTimePeriod: parsed.timeRange.label,
        lastResults: [storeData.id],
      },
    };
  }

  /**
   * GENERAL_DARKOPS_KNOWLEDGE: Deterministic DarkOps architectural answers
   */
  private getDarkOpsKnowledge(question: string): AssistantResponse {
    const q = question.toLowerCase();

    for (const item of this.darkOpsKnowledge) {
      if (item.keywords.some((kw) => q.includes(kw))) {
        return {
          intent: "GENERAL_DARKOPS_KNOWLEDGE",
          answer: item.answer,
          summary: "DarkOps System Knowledge",
          metrics: [],
          evidence: [],
          suggestedQuestions: [
            "What is happening across the network?",
            "Which stores have the most complaints?",
            "What can you do?",
          ],
          context: { lastIntent: "GENERAL_DARKOPS_KNOWLEDGE" },
        };
      }
    }

    return this.getUnsupportedResponse();
  }

  /**
   * HELP: Interactive capability discovery
   */
  private getHelpResponse(): AssistantResponse {
    const answer = `I am the DarkOps Executive Operational Copilot. I analyze live database metrics to answer operational intelligence questions across these capabilities:

Network
- "What's happening across the network?"
- "Give me an operational summary"

Trends
- "Are complaints increasing?"
- "Compare complaints this week with last week"

Stores
- "Which stores have the most complaints?"
- "Which dark stores are struggling?"

Cities
- "Which cities have the most issues?"
- "Where are complaints concentrated?"

SLA
- "Where are SLA breaches happening?"
- "How many cases are overdue?"

Automation
- "How effective is automation?"
- "How many issues were auto-resolved?"

Risk
- "Are there any risk areas?"
- "Any fraud risks?"

You can also ask follow-up questions about specific stores, cities, or categories mentioned in previous responses.`;

    return {
      intent: "HELP",
      answer,
      summary: "Supported analytical capabilities",
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "Are complaints increasing?",
        "How effective is automation?",
      ],
      context: { lastIntent: "HELP" },
    };
  }

  /**
   * UNSUPPORTED: Gracefully handle out-of-scope queries
   */
  private getUnsupportedResponse(): AssistantResponse {
    return {
      intent: "UNSUPPORTED",
      answer: "I can help with DarkOps operational intelligence, including network trends, complaints, stores, SLA performance, automation and risk.",
      summary: "Operational intelligence assistant",
      metrics: [],
      evidence: [],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "Are complaints increasing?",
        "How effective is automation?",
      ],
      context: { lastIntent: "UNSUPPORTED" },
    };
  }

  /**
   * EMPTY DATA BEHAVIOR: Gracefully handle zero database records
   */
  private getEmptyDataResponse(period: string): AssistantResponse {
    return {
      intent: "EMPTY_DATA",
      answer: "I don't have enough operational data for that period to give you a reliable answer.",
      summary: "No operational data for period",
      metrics: [],
      evidence: [{ label: "Time period", value: period }],
      suggestedQuestions: [
        "What is happening across the network?",
        "Which stores have the most complaints?",
        "Are complaints increasing?",
      ],
      context: { lastIntent: "EMPTY_DATA", lastTimePeriod: period },
    };
  }
}
