import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";

export type FraudDecision = "Pending review" | "Escalated" | "Approved" | "Denied";

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
}

export function useFraudCases() {
  return useQuery({
    queryKey: ["fraud"],
    queryFn: async () => {
      const response = await fetchApi("/fraud");

      const cases: FraudCase[] = response.data.map((row: any) => {
        let mappedDecision: FraudDecision = "Pending review";
        if (row.decision === "approved") mappedDecision = "Approved";
        else if (row.decision === "denied") mappedDecision = "Denied";
        else if (row.decision === "escalated") mappedDecision = "Escalated";

        return {
          id: row.id,
          caseId: row.complaint_id,
          complaintId: row.complaint_id,
          customerName: row.customers?.full_name || "Unknown",
          customerId: row.customer_id,
          storeId: row.complaints?.store_id || "Unknown",
          storeName: "Dark Store", // Will be populated by store join if needed
          orderId: row.complaints?.order_id || "Unknown",
          orderValue: (row.complaints?.order_value_paise || 0) / 100,
          refundAmount: (row.complaints?.refund_amount_paise || 0) / 100,
          confidence: row.risk_confidence || 0,
          reason: row.reason || "Unknown risk",
          decision: mappedDecision,
          priorClaims: row.customers?.prior_claims_90d || 0,
          upheldClaims: row.customers?.upheld_claims_90d || 0,
        };
      });

      // Compute KPIs from real data
      const highRisk = cases.filter((c) => c.confidence >= 90).length;
      const avgConfidence =
        cases.length > 0 ? cases.reduce((sum, c) => sum + c.confidence, 0) / cases.length : 0;
      const flaggedValue = cases.reduce((sum, c) => sum + c.refundAmount, 0);
      const repeatOffenders = cases.filter((c) => c.priorClaims > 0).length;

      return {
        cases,
        kpis: {
          highRisk,
          avgConfidence: Math.round(avgConfidence * 10) / 10,
          flaggedValue,
          flaggedClaims: cases.length,
          repeatOffenders,
        },
      };
    },
  });
}
