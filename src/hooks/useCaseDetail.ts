import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { queryClient } from "../lib/queryClient";
import { differenceInMinutes, format } from "date-fns";

export function useCaseDetail(id: string) {
  return useQuery({
    queryKey: ["case", id],
    queryFn: async () => {
      const response = await fetchApi(`/cases/${id}`);
      const row = response.data; // API now returns { data: {...} }

      const ageMins = differenceInMinutes(new Date(), new Date(row.created_at));

      return {
        id: row.id,
        complaintId: row.complaint_ref,
        customerId: row.customer_id,
        customerName: row.customers?.full_name || "Unknown",
        storeId: row.store_id,
        storeName: row.stores?.name || "Store",
        city: row.stores?.city || "Unknown",
        orderId: row.order_id,
        orderValue: (row.order_value_paise || 0) / 100,
        refundAmount: (row.refund_amount_paise || 0) / 100,
        type: row.type || "operational_investigation",
        category: row.category,
        urgency: row.priority === "P1" || row.priority === "P2" ? "High" : "Normal",
        sentiment: row.sentiment || null,
        classifierConfidence: row.classifier_confidence ?? null,
        qcScore: row.qc_score ?? null,
        priority: row.priority,
        status: row.status,
        summary: row.summary,
        detail: row.detail,
        ageMins,
        // Normalize DB enum (on_track/at_risk) to the hyphenated form SlaIndicator expects.
        sla:
          row.sla_state === "breached"
            ? "breached"
            : row.sla_state === "at_risk"
              ? "at-risk"
              : "on-track",
        slaDueIST: row.sla_due_at
          ? format(new Date(row.sla_due_at), "HH:mm")
          : format(new Date(new Date(row.created_at).getTime() + 120 * 60000), "HH:mm"),
        resolution: row.resolution || null,
        agentId: row.assigned_agent_id,
        agentName: row.assigned_agent?.full_name || null,
        fraudReview: row.fraud_review || null,
        // Real status-history events, shaped for the Timeline component.
        events: (row.complaint_status_history || [])
          .slice()
          .sort(
            (a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime(),
          )
          .map((e: any) => ({
            label: e.to_status
              ? `Status: ${String(e.to_status).replace(/_/g, " ")}`
              : "Case update",
            at: e.changed_at ? format(new Date(e.changed_at), "dd MMM, HH:mm") : "",
            detail: e.note || undefined,
          })),
      };
    },
  });
}

export function useAssignCase() {
  return useMutation({
    mutationFn: async ({ id, agentId }: { id: string; agentId: string }) => {
      return await fetchApi(`/cases/${id}/assign`, {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["case", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useEscalateCase() {
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      return await fetchApi(`/cases/${id}/escalate`, {
        method: "POST",
        body: JSON.stringify(note ? { note } : {}),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["case", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

export function useResolveCase() {
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution?: string }) => {
      return await fetchApi(`/cases/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["case", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

/** Fetches all available operations agents for assignment. */
export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const response = await fetchApi("/cases/agents");
      return (response.data || []) as Array<{
        id: string;
        name: string;
        hub: string;
        load: number;
        capacity: number;
      }>;
    },
    staleTime: 5 * 60 * 1000, // agents list is relatively stable
  });
}
