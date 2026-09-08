// NLP Service for complaint classification, urgency scoring, and sentiment analysis
// A deterministic, explainable, rule-based engine utilizing weighted signals and margin-of-victory scoring.

export interface NLPAnalysis {
  category: string;
  type: string;
  urgency_score: number; // 0-100
  sentiment: "positive" | "neutral" | "negative" | "highly_negative";
  confidence: number; // 0-100
}

export interface RefundValidation {
  can_auto_approve: boolean;
  reason?: string;
  max_refund_amount?: number;
}

export interface ReorderValidation {
  can_auto_approve: boolean;
  reason?: string;
}

// ------------------------------------------------------------------
// DICTIONARIES
// ------------------------------------------------------------------

interface WeightedKeyword {
  word: string;
  weight: number; // 3 for strong, 1 for weak
}

// Classification Dictionaries
const CATEGORY_SIGNALS: Record<string, WeightedKeyword[]> = {
  missing_item: [
    { word: "missing", weight: 3 },
    { word: "not received", weight: 3 },
    { word: "didn't get", weight: 3 },
    { word: "did not receive", weight: 3 },
    { word: "forgot", weight: 2 },
    { word: "incomplete", weight: 2 },
    { word: "short", weight: 1 },
    { word: "less", weight: 1 },
    { word: "absent", weight: 1 },
  ],
  wrong_item: [
    { word: "wrong", weight: 3 },
    { word: "incorrect", weight: 3 },
    { word: "different", weight: 3 },
    { word: "instead of", weight: 3 },
    { word: "but received", weight: 2 },
    { word: "not what i ordered", weight: 3 },
    { word: "substitute", weight: 2 },
    { word: "replacement", weight: 2 },
    { word: "mixed up", weight: 2 },
    { word: "error", weight: 1 },
  ],
  damaged_item: [
    { word: "damaged", weight: 3 },
    { word: "broken", weight: 3 },
    { word: "crushed", weight: 3 },
    { word: "leaking", weight: 3 },
    { word: "spilled", weight: 3 },
    { word: "torn", weight: 3 },
    { word: "smashed", weight: 3 },
    { word: "ruined", weight: 2 },
    { word: "open", weight: 1 },
  ],
  quality_issue: [
    { word: "rotten", weight: 3 },
    { word: "spoiled", weight: 3 },
    { word: "expired", weight: 3 },
    { word: "stale", weight: 3 },
    { word: "mold", weight: 3 },
    { word: "smells bad", weight: 3 },
    { word: "bad quality", weight: 2 },
    { word: "poor quality", weight: 2 },
    { word: "tasteless", weight: 1 },
    { word: "hard", weight: 1 },
    { word: "soggy", weight: 1 },
  ],
  late_delivery: [
    { word: "late", weight: 3 },
    { word: "delayed", weight: 3 },
    { word: "took too long", weight: 3 },
    { word: "hours", weight: 2 },
    { word: "waiting", weight: 2 },
    { word: "slow", weight: 2 },
    { word: "not delivered yet", weight: 3 },
    { word: "time", weight: 1 },
  ],
  payment_issue: [
    { word: "charged twice", weight: 3 },
    { word: "extra charge", weight: 3 },
    { word: "overcharged", weight: 3 },
    { word: "refund", weight: 2 },
    { word: "billing", weight: 2 },
    { word: "payment", weight: 2 },
    { word: "money", weight: 1 },
    { word: "card", weight: 1 },
  ],
};

const TYPE_SIGNALS: Record<string, WeightedKeyword[]> = {
  refund: [
    { word: "refund", weight: 3 },
    { word: "money back", weight: 3 },
    { word: "chargeback", weight: 3 },
    { word: "compensate", weight: 2 },
    { word: "return", weight: 2 },
  ],
  reorder: [
    { word: "reorder", weight: 3 },
    { word: "send again", weight: 3 },
    { word: "replacement", weight: 2 },
    { word: "replace", weight: 2 },
    { word: "same order", weight: 2 },
  ],
};

// Urgency Modifiers
const URGENCY_SIGNALS = {
  escalators: [
    { word: "urgent", weight: 30 },
    { word: "emergency", weight: 30 },
    { word: "immediately", weight: 30 },
    { word: "critical", weight: 30 },
    { word: "asap", weight: 20 },
    { word: "serious", weight: 20 },
    { word: "right now", weight: 20 },
    { word: "need", weight: 10 },
    { word: "help", weight: 10 },
    { word: "dangerous", weight: 30 }, // health/safety
    { word: "unsafe", weight: 30 },
  ],
  mitigators: [
    { word: "no rush", weight: -20 },
    { word: "whenever", weight: -20 },
    { word: "not urgent", weight: -20 },
    { word: "minor", weight: -10 },
    { word: "small", weight: -10 },
  ],
};

// Sentiment Modifiers
const SENTIMENT_SIGNALS = {
  positive: [
    { word: "thank", weight: 2 },
    { word: "thanks", weight: 2 },
    { word: "great", weight: 2 },
    { word: "good", weight: 1 },
    { word: "appreciate", weight: 2 },
    { word: "happy", weight: 2 },
    { word: "excellent", weight: 3 },
  ],
  negative: [
    { word: "terrible", weight: 2 },
    { word: "horrible", weight: 2 },
    { word: "disappointed", weight: 2 },
    { word: "upset", weight: 2 },
    { word: "frustrated", weight: 2 },
    { word: "annoyed", weight: 1 },
    { word: "bad", weight: 1 },
  ],
  highly_negative: [
    { word: "angry", weight: 4 },
    { word: "furious", weight: 4 },
    { word: "worst", weight: 4 },
    { word: "never again", weight: 4 },
    { word: "unacceptable", weight: 4 },
    { word: "disgusting", weight: 4 },
    { word: "lawsuit", weight: 5 },
    { word: "scam", weight: 5 },
  ],
};

// ------------------------------------------------------------------
// ENGINE IMPLEMENTATION
// ------------------------------------------------------------------

/**
 * Normalizes text for robust matching.
 * Converts to lowercase, removes excessive punctuation, and collapses spaces.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Scans text against a dictionary of weighted keywords.
 * Uses word boundaries to avoid partial matches (e.g., "late" matching "plate").
 */
function scoreDictionary(text: string, dictionary: Record<string, WeightedKeyword[]>): Record<string, number> {
  const scores: Record<string, number> = {};
  
  for (const [key, keywords] of Object.entries(dictionary)) {
    scores[key] = 0;
    for (const kw of keywords) {
      // Create a regex for whole word or phrase matching
      const regex = new RegExp(`\\b${kw.word}\\b`, 'g');
      const matches = text.match(regex);
      if (matches) {
        // Add weight for each occurrence
        scores[key] += kw.weight * matches.length;
      }
    }
  }
  return scores;
}

export function analyzeComplaint(summary: string, detail: string): NLPAnalysis {
  const rawText = `${summary} ${detail}`;
  const text = normalizeText(rawText);

  // 1. CLASSIFICATION & CONFIDENCE
  const categoryScores = scoreDictionary(text, CATEGORY_SIGNALS);
  
  // Sort categories by score descending
  const sortedCategories = Object.entries(categoryScores)
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);

  const [topCategory, topScore] = sortedCategories[0];
  const [, runnerUpScore] = sortedCategories[1];

  let category = "other";
  let confidence = 0;

  if (topScore === 0) {
    // No evidence found: ambiguous text
    category = "other";
    confidence = 10; // Very low confidence, forces agent review
  } else {
    category = topCategory;
    
    // Calculate base confidence from signal strength (e.g., score 3 = 60%, score 6 = 100%)
    let baseConfidence = Math.min(100, topScore * 20);
    
    // Penalize if there are competing signals (margin of victory logic)
    // E.g., Top = 6 (wrong item), RunnerUp = 3 (missing item) -> Margin = 3
    // If margin is small, confidence drops due to mixed evidence.
    const margin = topScore - runnerUpScore;
    
    if (runnerUpScore > 0) {
      if (margin === 0) {
        // Tied evidence: highly ambiguous classification
        baseConfidence -= 40;
      } else if (margin <= 2) {
        // Tight margin: conflicting evidence present
        baseConfidence -= 20;
      } else {
        // Clear winner, but acknowledge some noise
        baseConfidence -= 5;
      }
    }

    confidence = Math.max(0, Math.min(100, baseConfidence));
  }

  // 2. TYPE DETERMINATION (Refund vs Reorder vs Ops)
  const typeScores = scoreDictionary(text, TYPE_SIGNALS);
  let type = "operational_investigation"; // Default
  if (typeScores.refund > typeScores.reorder && typeScores.refund > 0) {
    type = "refund";
  } else if (typeScores.reorder > typeScores.refund && typeScores.reorder > 0) {
    type = "reorder";
  } else if (category === "damaged_item" || category === "quality_issue" || category === "payment_issue") {
    // Fallback logic based on category severity
    type = "refund";
  }

  // 3. URGENCY
  let urgencyScore = 50; // Neutral baseline
  
  // Apply explicit escalators and mitigators
  for (const kw of URGENCY_SIGNALS.escalators) {
    if (text.match(new RegExp(`\\b${kw.word}\\b`, 'g'))) urgencyScore += kw.weight;
  }
  for (const kw of URGENCY_SIGNALS.mitigators) {
    if (text.match(new RegExp(`\\b${kw.word}\\b`, 'g'))) urgencyScore += kw.weight;
  }

  // Contextual baseline adjustments based on resolved category
  if (category === "payment_issue") urgencyScore += 15; // Payment issues cause high anxiety
  if (category === "late_delivery") urgencyScore += 10; 
  if (category === "quality_issue") urgencyScore += 10; // Potential health risk
  
  urgencyScore = Math.max(0, Math.min(100, urgencyScore));

  // 4. SENTIMENT
  let positiveScore = 0;
  let negativeScore = 0;
  let highlyNegativeScore = 0;

  for (const kw of SENTIMENT_SIGNALS.positive) {
    if (text.match(new RegExp(`\\b${kw.word}\\b`, 'g'))) positiveScore += kw.weight;
  }
  for (const kw of SENTIMENT_SIGNALS.negative) {
    if (text.match(new RegExp(`\\b${kw.word}\\b`, 'g'))) negativeScore += kw.weight;
  }
  for (const kw of SENTIMENT_SIGNALS.highly_negative) {
    if (text.match(new RegExp(`\\b${kw.word}\\b`, 'g'))) highlyNegativeScore += kw.weight;
  }

  let sentiment: "positive" | "neutral" | "negative" | "highly_negative" = "neutral";
  
  if (highlyNegativeScore > 0 && highlyNegativeScore >= positiveScore) {
    sentiment = "highly_negative";
  } else if (negativeScore > positiveScore) {
    sentiment = "negative";
  } else if (positiveScore > negativeScore && positiveScore > highlyNegativeScore) {
    sentiment = "positive";
  }

  return {
    category,
    type,
    urgency_score: urgencyScore,
    sentiment,
    confidence,
  };
}

export function validateRefund(
  orderAmountPaise: number,
  refundAmountPaise: number,
  customerRefundHistory: number,
  customerPriorClaims: number,
): RefundValidation {
  const orderAmount = orderAmountPaise / 100;
  const refundAmount = refundAmountPaise / 100;

  if (refundAmount > orderAmount) {
    return {
      can_auto_approve: false,
      reason: "Refund amount exceeds order amount",
      max_refund_amount: orderAmountPaise,
    };
  }

  if (refundAmount > 500) {
    return {
      can_auto_approve: false,
      reason: "High-value refund requires manual review",
      max_refund_amount: 50000, 
    };
  }

  if (customerPriorClaims > 3) {
    return {
      can_auto_approve: false,
      reason: "Customer has high refund frequency, requires manual review",
    };
  }

  if (customerRefundHistory > 100000) {
    return {
      can_auto_approve: false,
      reason: "Customer refund history exceeds threshold, requires manual review",
    };
  }

  return { can_auto_approve: true };
}

export function validateReorder(
  orderAgeHours: number,
  customerReorderHistory: number,
): ReorderValidation {
  if (orderAgeHours > 24) {
    return {
      can_auto_approve: false,
      reason: "Reorder window expired (24 hours)",
    };
  }

  if (customerReorderHistory > 5) {
    return {
      can_auto_approve: false,
      reason: "Customer has excessive reorder history, requires manual review",
    };
  }

  return { can_auto_approve: true };
}

export function calculatePriority(urgencyScore: number, sentiment: string): string {
  // P1/P2/P3/P4 mapping used internally by routing engine
  if (urgencyScore >= 80) return "P1";
  if (urgencyScore >= 60) return "P2";
  if (urgencyScore >= 40) return "P3";
  return "P4";
}

export function calculateSLADeadline(priority: string, createdAt: Date): Date {
  const slaMinutes = {
    P1: 15,
    P2: 30,
    P3: 120,
    P4: 480,
  };

  const deadline = new Date(createdAt);
  deadline.setMinutes(deadline.getMinutes() + slaMinutes[priority as keyof typeof slaMinutes]);
  return deadline;
}
