// NLP Service for complaint classification, urgency scoring, and sentiment analysis
// Uses keyword-based analysis (can be replaced with actual ML models in production)

export interface NLPAnalysis {
  category: string;
  type: string;
  urgency_score: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
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

// Keywords for complaint classification
const CATEGORY_KEYWORDS = {
  late_delivery: ['late', 'delay', 'slow', 'took too long', 'not delivered', 'waiting', 'hours', 'days'],
  quality_issue: ['bad', 'rotten', 'spoiled', 'stale', 'expired', 'damaged', 'broken', 'crushed', 'poor quality', 'tasteless'],
  missing_item: ['missing', 'not received', 'short', 'incomplete', 'forgot', 'didn\'t include', 'less'],
  wrong_item: ['wrong', 'incorrect', 'different', 'not what i ordered', 'substitute', 'replacement'],
  damaged_item: ['damaged', 'broken', 'crushed', 'leaking', 'spilled', 'torn'],
  payment_issue: ['payment', 'charge', 'refund', 'money', 'charged twice', 'extra', 'billing'],
  other: []
};

const TYPE_KEYWORDS = {
  refund: ['refund', 'money back', 'return', 'chargeback', 'compensate'],
  reorder: ['reorder', 'send again', 'replace', 'replacement', 'same order'],
  operational_investigation: []
};

const URGENCY_KEYWORDS = {
  high: ['urgent', 'emergency', 'immediately', 'asap', 'right now', 'critical', 'serious', 'very important'],
  medium: ['please', 'help', 'need', 'issue', 'problem', 'concern'],
  low: ['minor', 'small', 'little', 'not urgent', 'whenever', 'no rush']
};

const SENTIMENT_KEYWORDS = {
  positive: ['thank', 'thanks', 'great', 'good', 'appreciate', 'happy', 'satisfied', 'excellent'],
  negative: ['angry', 'furious', 'terrible', 'horrible', 'disappointed', 'upset', 'frustrated', 'annoyed', 'worst', 'never again']
};

export function analyzeComplaint(summary: string, detail: string): NLPAnalysis {
  const text = `${summary} ${detail}`.toLowerCase();
  
  // Classify category
  let category = 'other';
  let categoryScore = 0;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > categoryScore) {
      categoryScore = score;
      category = cat;
    }
  }
  
  // Classify type
  let type = 'operational_investigation';
  let typeScore = 0;
  for (const [t, keywords] of Object.entries(TYPE_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > typeScore) {
      typeScore = score;
      type = t;
    }
  }
  
  // Calculate urgency score (0-100)
  let urgencyScore = 50; // baseline
  for (const keyword of URGENCY_KEYWORDS.high) {
    if (text.includes(keyword)) urgencyScore += 20;
  }
  for (const keyword of URGENCY_KEYWORDS.medium) {
    if (text.includes(keyword)) urgencyScore += 5;
  }
  for (const keyword of URGENCY_KEYWORDS.low) {
    if (text.includes(keyword)) urgencyScore -= 10;
  }
  
  // Boost urgency for certain categories
  if (category === 'late_delivery') urgencyScore += 15;
  if (category === 'payment_issue') urgencyScore += 10;
  
  // Cap urgency score
  urgencyScore = Math.max(0, Math.min(100, urgencyScore));
  
  // Analyze sentiment
  let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  let positiveScore = 0;
  let negativeScore = 0;
  
  for (const keyword of SENTIMENT_KEYWORDS.positive) {
    if (text.includes(keyword)) positiveScore++;
  }
  for (const keyword of SENTIMENT_KEYWORDS.negative) {
    if (text.includes(keyword)) negativeScore++;
  }
  
  if (negativeScore > positiveScore) sentiment = 'negative';
  else if (positiveScore > negativeScore) sentiment = 'positive';
  
  // Calculate confidence based on keyword matches
  const totalMatches = categoryScore + typeScore + positiveScore + negativeScore;
  const confidence = Math.min(100, Math.round(totalMatches * 10));
  
  return {
    category,
    type,
    urgency_score: urgencyScore,
    sentiment,
    confidence
  };
}

export function validateRefund(
  orderAmountPaise: number,
  refundAmountPaise: number,
  customerRefundHistory: number,
  customerPriorClaims: number
): RefundValidation {
  const orderAmount = orderAmountPaise / 100;
  const refundAmount = refundAmountPaise / 100;
  
  // Rule 1: Refund amount cannot exceed order amount
  if (refundAmount > orderAmount) {
    return {
      can_auto_approve: false,
      reason: 'Refund amount exceeds order amount',
      max_refund_amount: orderAmountPaise
    };
  }
  
  // Rule 2: High-value refunds (>₹500) require manual review
  if (refundAmount > 500) {
    return {
      can_auto_approve: false,
      reason: 'High-value refund requires manual review',
      max_refund_amount: 50000 // ₹500 in paise
    };
  }
  
  // Rule 3: Customers with high refund frequency (>3 in 90 days) require manual review
  if (customerPriorClaims > 3) {
    return {
      can_auto_approve: false,
      reason: 'Customer has high refund frequency, requires manual review'
    };
  }
  
  // Rule 4: Total refund history >₹1000 requires manual review
  if (customerRefundHistory > 100000) { // ₹1000 in paise
    return {
      can_auto_approve: false,
      reason: 'Customer refund history exceeds threshold, requires manual review'
    };
  }
  
  // Auto-approve if all rules pass
  return {
    can_auto_approve: true
  };
}

export function validateReorder(
  orderAgeHours: number,
  customerReorderHistory: number
): ReorderValidation {
  // Rule 1: Reorders only allowed within 24 hours of original order
  if (orderAgeHours > 24) {
    return {
      can_auto_approve: false,
      reason: 'Reorder window expired (24 hours)'
    };
  }
  
  // Rule 2: Customers with excessive reorders (>5 in 30 days) require manual review
  if (customerReorderHistory > 5) {
    return {
      can_auto_approve: false,
      reason: 'Customer has excessive reorder history, requires manual review'
    };
  }
  
  // Auto-approve if all rules pass
  return {
    can_auto_approve: true
  };
}

export function calculatePriority(urgencyScore: number, sentiment: string): string {
  if (urgencyScore >= 80) return 'P1';
  if (urgencyScore >= 60) return 'P2';
  if (urgencyScore >= 40) return 'P3';
  return 'P4';
}

export function calculateSLADeadline(priority: string, createdAt: Date): Date {
  const slaMinutes = {
    'P1': 15,   // 15 minutes
    'P2': 30,   // 30 minutes
    'P3': 120,  // 2 hours
    'P4': 480   // 8 hours
  };
  
  const deadline = new Date(createdAt);
  deadline.setMinutes(deadline.getMinutes() + slaMinutes[priority as keyof typeof slaMinutes]);
  return deadline;
}
