import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import { queryClient } from '../lib/queryClient';

export function useFraudDetail(id: string) {
  return useQuery({
    queryKey: ['fraud', id],
    queryFn: async () => {
      const response = await fetchApi(`/fraud/${id}`);
      
      const row = response;
      
      let mappedDecision = "Pending review";
      if (row.decision === 'approved') mappedDecision = "Approved";
      else if (row.decision === 'denied') mappedDecision = "Denied";
      else if (row.decision === 'escalated') mappedDecision = "Escalated";
      
      return {
        id: row.id,
        caseId: row.complaint_id,
        complaintId: row.complaint_id,
        customerName: row.customers?.full_name || 'Unknown',
        customerId: row.customer_id,
        storeId: row.complaints?.store_id || 'Unknown',
        storeName: row.complaints?.stores?.name || 'Dark Store',
        orderId: row.complaints?.order_id || 'Unknown',
        orderValue: (row.complaints?.order_value_paise || 0) / 100,
        refundAmount: (row.complaints?.refund_amount_paise || 0) / 100,
        confidence: row.risk_confidence || 0,
        reason: row.reason,
        decision: mappedDecision,
        decisionNote: row.decision_note,
        decidedAt: row.decided_at,
        decidedBy: row.decided_by,
        priorClaims: row.customers?.prior_claims_90d || 0,
        upheldClaims: row.customers?.upheld_claims_90d || 0,
        factors: row.fraud_risk_factors?.map((f: any) => ({
          label: f.label,
          weight: f.weight,
          evidence: f.evidence,
        })) || [],
        complaint: row.complaints,
        customer: row.customers,
      };
    },
  });
}

export function useFraudHistory(id: string) {
  return useQuery({
    queryKey: ['fraud', id, 'history'],
    queryFn: async () => {
      const response = await fetchApi(`/fraud/${id}/history`);
      return response.data.map((h: any) => ({
        at: h.occurred_at,
        actor: h.actor_label,
        action: h.action,
      }));
    },
  });
}

export function useFraudDecision() {
  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string, decision: string, note?: string }) => {
      return await fetchApi(`/fraud/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: decision.toLowerCase().replace(' ', '_'), note }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fraud', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['fraud', variables.id, 'history'] });
      queryClient.invalidateQueries({ queryKey: ['fraud'] });
    },
  });
}
