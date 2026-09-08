import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "../lib/api";
import { differenceInMinutes } from "date-fns";

export interface Case {
  id: string;
  complaintId: string;
  storeId: string;
  storeName: string;
  customerId: string;
  customerName: string;
  status: string;
  priority: string;
  summary: string;
  ageMins: number;
  sla: "ok" | "at-risk" | "breached";
  agentId: string | null;
}

function calculateSla(priority: string, ageMins: number): "ok" | "at-risk" | "breached" {
  let slaTarget = 120; // default P3 = 2 hours
  if (priority === "P1") slaTarget = 15;
  else if (priority === "P2") slaTarget = 30;

  if (ageMins > slaTarget) return "breached";
  if (ageMins > slaTarget * 0.75) return "at-risk";
  return "ok";
}

export function useOperationsMetrics() {
  return useQuery({
    queryKey: ["operations-metrics"],
    queryFn: async () => {
      const response = await fetchApi("/cases/metrics");
      return response;
    },
  });
}

export function useCases() {
  return useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const response = await fetchApi("/cases?limit=100"); // fetch up to 100 cases
      const cases: Case[] = response.data.map((row: any) => {
        const ageMins = differenceInMinutes(new Date(), new Date(row.created_at));
        return {
          id: row.id,
          complaintId: row.complaint_ref,
          storeId: row.store_id,
          storeName: row.stores?.name || "Unknown Store",
          customerId: row.customer_id,
          customerName: row.customers?.full_name || "Unknown Customer",
          status: row.status,
          priority: row.priority,
          summary: row.summary || row.detail || "No description",
          ageMins,
          sla:
            row.sla_state === "breached"
              ? "breached"
              : row.sla_state === "at_risk"
                ? "at-risk"
                : "ok",
          agentId: row.assigned_agent_id,
        };
      });

      // Compute KPIs from data
      const pending = cases.filter((c) => c.status !== "resolved").length;
      const escalated = cases.filter((c) => c.status === "escalated_l2").length;
      const slaBreaches = cases.filter((c) => c.sla === "breached").length;
      const awaitingAssignment = cases.filter((c) => c.status === "unassigned").length;

      const pMix = [
        { name: "P1 Critical", value: cases.filter((c) => c.priority === "P1").length, key: "P1" },
        { name: "P2 High", value: cases.filter((c) => c.priority === "P2").length, key: "P2" },
        { name: "P3 Medium", value: cases.filter((c) => c.priority === "P3").length, key: "P3" },
        { name: "P4 Low", value: cases.filter((c) => c.priority === "P4").length, key: "P4" },
      ];

      const sMix = [
        { name: "Unassigned", value: awaitingAssignment },
        { name: "Assigned", value: cases.filter((c) => c.status === "assigned").length },
        { name: "In progress", value: cases.filter((c) => c.status === "in_progress").length },
      ];

      return {
        cases,
        kpis: {
          pending,
          escalated,
          slaBreaches,
          awaitingAssignment,
          agentsOnShift: cases.filter((c) => c.agentId).length, // Count unique assigned agents
          agentsAvailable: Math.max(
            0,
            cases.filter((c) => c.agentId).length -
              cases.filter((c) => c.status === "in_progress").length,
          ),
          oldestWaitingMins: Math.max(
            0,
            ...cases.filter((c) => c.status === "unassigned").map((c) => c.ageMins),
          ),
        },
        priorityMix: pMix,
        statusMix: sMix,
      };
    },
  });
}
