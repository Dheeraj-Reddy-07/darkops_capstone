// Dedicated Resolution Decision Service for DarkOps
// Implements simple, deterministic safety gates for resolution automation.
// Principle: "DarkOps Decides. Upstream Commerce Platform Executes."

export type RequestedResolutionType = 'REFUND' | 'REPLACEMENT' | 'SUPPORT_REVIEW' | 'INFORMATION_ONLY';
export type ResolutionDecisionType = 'REFUND' | 'REPLACEMENT' | 'SUPPORT_REVIEW' | 'NO_ACTION';
export type DecisionStatusType = 'APPROVED' | 'PENDING' | 'REJECTED';

export interface ResolutionResult {
  resolution_type: ResolutionDecisionType;
  decision_status: DecisionStatusType;
  decision_reason: string;
  execution_required: boolean;
  auto_eligible: boolean;
  failure_gate?: string;
}

// Configurable Automation Safety Policy (seed/demo friendly defaults)
export const AUTOMATION_POLICY_CONFIG = {
  MIN_COMPLETED_ORDERS_FOR_AUTO_RESOLVE: 2, // New customer threshold
  MAX_PER_REQUEST_REFUND_PAISE: 50000,       // ₹500 per-request limit
  MAX_RECENT_AUTO_REFUNDS_90D: 3,           // Automated resolution allowance count limit
  MIN_CLASSIFICATION_CONFIDENCE: 40,         // Minimum NLP confidence percentage
  MAX_REPLACEMENT_ORDER_AGE_HOURS: 24,       // Replacement order age window (hours)
};

// Category → Contextually valid requested resolution mapping
const VALID_CATEGORY_RESOLUTIONS: Record<string, RequestedResolutionType[]> = {
  missing_item: ['REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW'],
  wrong_item: ['REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW'],
  damaged_item: ['REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW'],
  quality_issue: ['REFUND', 'REPLACEMENT', 'SUPPORT_REVIEW'],
  late_delivery: ['REFUND', 'SUPPORT_REVIEW'],
  payment_issue: ['REFUND', 'SUPPORT_REVIEW'],
  other: ['SUPPORT_REVIEW', 'INFORMATION_ONLY'],
};

/**
 * Validates whether a requested resolution is contextually valid for a given complaint category.
 */
export function validateRequestedResolution(
  category: string,
  requestedResolution: string,
): { valid: boolean; allowed: RequestedResolutionType[] } {
  const normalizedCategory = (category || 'other').toLowerCase();
  const allowed = VALID_CATEGORY_RESOLUTIONS[normalizedCategory] || ['SUPPORT_REVIEW', 'INFORMATION_ONLY'];
  const normalizedRequest = (requestedResolution || 'SUPPORT_REVIEW').toUpperCase() as RequestedResolutionType;
  const valid = allowed.includes(normalizedRequest);

  return { valid, allowed };
}

/**
 * Evaluates resolution eligibility using simple, deterministic safety gates.
 * No ML models, no fraud risk scoring, no hidden trust metrics.
 */
export function evaluateResolutionEligibility(
  complaint: any,
  order: any,
  customer: any,
  nlpAnalysis: any,
  requestedResolution: string,
): ResolutionResult {
  const category = complaint.category || nlpAnalysis?.category || 'other';
  const normRequested = (requestedResolution || 'SUPPORT_REVIEW').toUpperCase() as RequestedResolutionType;

  // 1. Gate 1: Category vs Requested Resolution Validity
  const { valid, allowed } = validateRequestedResolution(category, normRequested);
  if (!valid) {
    return {
      resolution_type: 'SUPPORT_REVIEW',
      decision_status: 'PENDING',
      decision_reason: `Requested resolution '${requestedResolution}' is not contextually valid for category '${category}'. Contextually allowed choices: ${allowed.join(', ')}. Routed to Support Agent queue.`,
      execution_required: false,
      auto_eligible: false,
      failure_gate: 'INVALID_CATEGORY_RESOLUTION',
    };
  }

  const confidence = nlpAnalysis?.confidence ?? 50;
  const orderAmountPaise = order?.total_amount_paise || 0;
  const priorClaims = customer?.prior_claims_90d || 0;
  const totalCompletedOrders = customer?.total_completed_orders ?? (priorClaims > 0 ? 5 : 0);

  // Order age calculation
  const placedAt = order?.placed_at ? new Date(order.placed_at).getTime() : Date.now();
  const orderAgeHours = Math.max(0, (Date.now() - placedAt) / (1000 * 60 * 60));

  switch (normRequested) {
    case 'REFUND': {
      // Gate 2: Classification Confidence
      const confidenceOk = confidence >= AUTOMATION_POLICY_CONFIG.MIN_CLASSIFICATION_CONFIDENCE;
      if (!confidenceOk) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `Classification confidence (${confidence}%) below threshold (${AUTOMATION_POLICY_CONFIG.MIN_CLASSIFICATION_CONFIDENCE}%). Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'LOW_CLASSIFICATION_CONFIDENCE',
        };
      }

      // Gate 3: New Customer Policy (Sufficient order history)
      const establishedHistory = totalCompletedOrders >= AUTOMATION_POLICY_CONFIG.MIN_COMPLETED_ORDERS_FOR_AUTO_RESOLVE;
      if (!establishedHistory) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `New customer policy: Account has insufficient completed order history for automated financial resolution. Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'NEW_CUSTOMER_INSUFFICIENT_HISTORY',
        };
      }

      // Gate 4: Per-Request Amount Threshold
      const amountOk = orderAmountPaise <= AUTOMATION_POLICY_CONFIG.MAX_PER_REQUEST_REFUND_PAISE;
      if (!amountOk) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `Requested refund amount (Rs ${(orderAmountPaise / 100).toFixed(2)}) exceeds per-request automated threshold of Rs ${(AUTOMATION_POLICY_CONFIG.MAX_PER_REQUEST_REFUND_PAISE / 100).toFixed(2)}. Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'AMOUNT_EXCEEDS_THRESHOLD',
        };
      }

      // Gate 5: Automated Resolution Allowance (Recent claim limit)
      const allowanceOk = priorClaims < AUTOMATION_POLICY_CONFIG.MAX_RECENT_AUTO_REFUNDS_90D;
      if (!allowanceOk) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `Recent automated resolution allowance reached (${priorClaims} recent claims). Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'AUTOMATION_ALLOWANCE_EXCEEDED',
        };
      }

      // All 5 gates passed → AUTO REFUND APPROVED
      return {
        resolution_type: 'REFUND',
        decision_status: 'APPROVED',
        decision_reason: `Auto-approved refund: Established customer history, order amount within threshold, clean recent resolution allowance, and high classification confidence.`,
        execution_required: true,
        auto_eligible: true,
      };
    }

    case 'REPLACEMENT': {
      // Gate 2: Classification Confidence
      const confidenceOk = confidence >= AUTOMATION_POLICY_CONFIG.MIN_CLASSIFICATION_CONFIDENCE;
      if (!confidenceOk) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `Classification confidence (${confidence}%) below threshold (${AUTOMATION_POLICY_CONFIG.MIN_CLASSIFICATION_CONFIDENCE}%). Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'LOW_CLASSIFICATION_CONFIDENCE',
        };
      }

      // Gate 3: Customer History
      const establishedHistory = totalCompletedOrders >= AUTOMATION_POLICY_CONFIG.MIN_COMPLETED_ORDERS_FOR_AUTO_RESOLVE;
      if (!establishedHistory) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `New customer policy: Account has insufficient order history for automated replacement. Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'NEW_CUSTOMER_INSUFFICIENT_HISTORY',
        };
      }

      // Gate 4: Order Age Window
      const orderWindowValid = orderAgeHours <= AUTOMATION_POLICY_CONFIG.MAX_REPLACEMENT_ORDER_AGE_HOURS;
      if (!orderWindowValid) {
        return {
          resolution_type: 'SUPPORT_REVIEW',
          decision_status: 'PENDING',
          decision_reason: `Order placed ${orderAgeHours.toFixed(1)}h ago (replacement window is ${AUTOMATION_POLICY_CONFIG.MAX_REPLACEMENT_ORDER_AGE_HOURS}h). Routed to Support Agent review.`,
          execution_required: false,
          auto_eligible: false,
          failure_gate: 'REPLACEMENT_WINDOW_EXPIRED',
        };
      }

      // All gates passed → AUTO REPLACEMENT APPROVED
      return {
        resolution_type: 'REPLACEMENT',
        decision_status: 'APPROVED',
        decision_reason: `Auto-approved replacement: Order placed within ${orderAgeHours.toFixed(1)}h, established customer history, and valid category.`,
        execution_required: true,
        auto_eligible: true,
      };
    }

    case 'INFORMATION_ONLY': {
      return {
        resolution_type: 'NO_ACTION',
        decision_status: 'APPROVED',
        decision_reason: 'Information only complaint submitted - logged for operational records.',
        execution_required: false,
        auto_eligible: true,
      };
    }

    case 'SUPPORT_REVIEW':
    default: {
      return {
        resolution_type: 'SUPPORT_REVIEW',
        decision_status: 'PENDING',
        decision_reason: 'Customer requested manual support review - queued for Support Agent action.',
        execution_required: false,
        auto_eligible: false,
      };
    }
  }
}
