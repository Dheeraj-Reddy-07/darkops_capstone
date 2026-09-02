import { intBetween, pick, rngFor } from "./random";
import { CASES, type CaseRecord } from "./cases";
import { istClock } from "./format";

export type FraudDecision = "Pending review" | "Escalated" | "Approved" | "Denied";

export interface RiskFactor {
  label: string;
  weight: number;
  evidence: string;
}

export interface FraudCase {
  id: string;
  caseId: string;
  complaintId: string;
  customerName: string;
  customerId: string;
  storeId: string;
  storeName: string;
  orderId: string;
  orderValue: number;
  refundAmount: number;
  confidence: number;
  reason: string;
  decision: FraudDecision;
  priorClaims: number;
  upheldClaims: number;
  factors: RiskFactor[];
  history: Array<{ at: string; actor: string; action: string }>;
}

const REASONS = [
  "7 cold-chain refunds in 30d · same store, same SKU family",
  "Missing-item claim without pack-station weight variance",
  "Refund requested after rider POD image match",
  "Late-delivery claim, GPS shows on-time handover",
  "3 accounts sharing device fingerprint & address",
  "Damaged-goods photo reused from prior claim",
  "Refund velocity 4x cohort median",
  "Wrong-item claim on order with sealed-tote scan match",
  "Claim raised 11 min after delivery on every order this week",
  "Address flagged in 4 upheld abuse cases in 90d",
];

const FACTOR_LIBRARY: RiskFactor[] = [
  { label: "Claim velocity", weight: 32, evidence: "9 refund claims in the last 30 days vs cohort median of 2" },
  { label: "Evidence quality", weight: 24, evidence: "Uploaded photo hash matches an image submitted on an earlier claim" },
  { label: "Device & address linkage", weight: 18, evidence: "3 accounts share one device fingerprint and delivery address" },
  { label: "Operational contradiction", weight: 16, evidence: "Pack-station weight and rider POD both consistent with a complete delivery" },
  { label: "Value concentration", weight: 10, evidence: "Claims concentrated on the highest-value lines of each basket" },
];

function build(): FraudCase[] {
  const rand = rngFor("fraud-queue-v1");
  const refundCases: CaseRecord[] = CASES.filter((c) => c.type === "Refund").slice(0, 14);

  return refundCases.map((c, i) => {
    const confidence = Math.round(56 + rand() * 42);
    const decision: FraudDecision =
      i % 5 === 1 ? "Escalated" : i % 5 === 2 ? "Denied" : i % 5 === 3 ? "Approved" : "Pending review";
    const priorClaims = intBetween(rand, 1, 11);
    return {
      id: c.complaintId,
      caseId: c.id,
      complaintId: c.complaintId,
      customerName: c.customerName,
      customerId: c.customerId,
      storeId: c.storeId,
      storeName: c.storeName,
      orderId: c.orderId,
      orderValue: c.orderValue,
      refundAmount: c.refundAmount,
      confidence,
      reason: REASONS[i % REASONS.length]!,
      decision,
      priorClaims,
      upheldClaims: Math.max(0, Math.round(priorClaims * rand() * 0.6)),
      factors: FACTOR_LIBRARY.map((f) => ({
        ...f,
        weight: Math.max(4, Math.round(f.weight * (0.6 + rand() * 0.8))),
      })).sort((a, b) => b.weight - a.weight),
      history: [
        { at: `${istClock(210)} IST`, actor: "Risk engine", action: `Flagged at ${confidence}% confidence` },
        { at: `${istClock(150)} IST`, actor: "Ops QC · AG-1188", action: "Evidence pack attached" },
        ...(decision === "Pending review"
          ? []
          : [
              {
                at: `${istClock(40)} IST`,
                actor: `Risk analyst · ${pick(rand, ["AG-0917", "AG-2041", "AG-1502"])}`,
                action: `Decision recorded — ${decision}`,
              },
            ]),
      ],
    };
  });
}

export const FRAUD_CASES: FraudCase[] = build();
export const FRAUD_BY_ID = new Map(FRAUD_CASES.map((f) => [f.id, f]));

export function getFraudCase(id: string) {
  return FRAUD_BY_ID.get(id);
}

export function fraudForCase(caseId: string) {
  return FRAUD_CASES.find((f) => f.caseId === caseId) ?? null;
}

export const FRAUD_KPIS = {
  highRisk: 214,
  avgConfidence: 87.3,
  flaggedValue: 1840000,
  flaggedClaims: 946,
  repeatOffenders: 63,
  scoredLast24h: 8214,
};
