import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchApi } from '../lib/api';
import { queryClient } from '../lib/queryClient';
import { differenceInMinutes, format } from 'date-fns';

export function useCaseDetail(id: string) {
  return useQuery({
    queryKey: ['case', id],
    queryFn: async () => {
      const response = await fetchApi(`/cases/${id}`);
      const row = response.data; // API now returns { data: {...} }
      
      const ageMins = differenceInMinutes(new Date(), new Date(row.created_at));
      
      return {
        id: row.id,
        complaintId: row.complaint_ref,
        customerId: row.customer_id,
        customerName: row.customers?.full_name || 'Unknown',
        storeId: row.store_id,
        storeName: row.stores?.name || 'Store',
        city: row.stores?.city || 'Unknown',
        orderId: row.order_id,
        orderValue: (row.order_value_paise || 0) / 100,
        refundAmount: (row.refund_amount_paise || 0) / 100,
        partner: row.delivery_partner_name || 'FastDash',
        partnerId: row.delivery_partner_id || 'P-94',
        type: row.type || 'operational_investigation',
        category: row.category,
        urgency: row.priority === 'P1' || row.priority === 'P2' ? 'High' : 'Normal',
        sentiment: 'Negative',
        classifierConfidence: row.classifier_confidence || 89,
        qcScore: row.qc_score || 92,
        priority: row.priority,
        status: row.status,
        summary: row.summary,
        detail: row.detail,
        ageMins,
        sla: row.sla_state || 'ok',
        slaDueIST: row.sla_deadline
          ? format(new Date(row.sla_deadline), "HH:mm")
          : format(new Date(new Date(row.created_at).getTime() + 120 * 60000), "HH:mm"),
        resolution: row.resolution || 'Pending investigation',
        agentId: row.assigned_agent_id,
        agentName: row.agent_name || null,
        agentHub: 'Ops Hub',
        fraudReview: row.fraud_review || null,
        events: row.complaint_status_history || [],
      };
    },
  });
}

export function useAssignCase() {
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string, agentId: string }) => {
      return await fetchApi(`/cases/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

export function useEscalateCase() {
  return useMutation({
    mutationFn: async ({ id, level }: { id: string, level: string }) => {
      return await fetchApi(`/cases/${id}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ level }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

export function useResolveCase() {
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string, resolution?: string }) => {
      return await fetchApi(`/cases/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['case', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}

/** Fetches all available operations agents for assignment. */
export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await fetchApi('/cases/agents');
      return (response.data || []) as Array<{ id: string; name: string; hub: string; load: number; capacity: number }>;
    },
    staleTime: 5 * 60 * 1000, // agents list is relatively stable
  });
}
