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
  category: string;
  summary: string;
  ageMins: number;
  sla: "ok" | "at-risk" | "breached";
  agentId: string | null;
  agentName: string | null;
}

function calculateSla(priority: string, ageMins: number): "ok" | "at-risk" | "breached" {
  let slaTarget = 120; // default P3 = 2 hours
  if (priority === "P1") slaTarget = 15;
  else if (priority === "P2") slaTarget = 30;

  if (ageMins > slaTarget) return "breached";
  if (ageMins > slaTarget * 0.75) return "at-risk";
  return "ok";
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
  missing_item: "Missing items",
  late_delivery: "Delivery delays",
  wrong_item: "Wrong items",
  damaged_item: "Damaged items",
  quality_issue: "Quality issues",
  payment_issue: "Payment issues",
  other: "Other issues",
};

export function useOperationsMetrics() {
  return useQuery({
    queryKey: ["operations-metrics"],
    queryFn: async () => {
      const response = await fetchApi("/cases/metrics");
      return response;
    },
  });
}

export function useCases(autoRefresh: boolean = false) {
  return useQuery({
    queryKey: ["cases"],
    refetchInterval: autoRefresh ? 30000 : false,
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
          category: row.category || "other",
          summary: row.summary || row.detail || "No description",
          ageMins,
          sla:
            row.sla_state === "breached"
              ? "breached"
              : row.sla_state === "at_risk"
                ? "at-risk"
                : "ok",
          agentId: row.assigned_agent_id,
          agentName: row.assigned_agent?.full_name || null,
        };
      });

      // Compute KPIs from data
      const pendingCases = cases.filter((c) => c.status !== "resolved");
      const pending = pendingCases.length;
      const escalated = cases.filter((c) => c.status === "escalated_l2").length;
      const slaBreaches = cases.filter((c) => c.sla === "breached").length;
      const awaitingAssignment = cases.filter((c) => c.status === "unassigned").length;

      const pMix = [
        {
          name: "P1 Critical",
          value: pendingCases.filter((c) => c.priority === "P1").length,
          key: "P1",
        },
        {
          name: "P2 High",
          value: pendingCases.filter((c) => c.priority === "P2").length,
          key: "P2",
        },
        {
          name: "P3 Medium",
          value: pendingCases.filter((c) => c.priority === "P3").length,
          key: "P3",
        },
        {
          name: "P4 Low",
          value: pendingCases.filter((c) => c.priority === "P4").length,
          key: "P4",
        },
      ];

      const sMix = [
        { name: "Unassigned", value: awaitingAssignment },
        { name: "Assigned", value: cases.filter((c) => c.status === "assigned").length },
        { name: "In progress", value: cases.filter((c) => c.status === "in_progress").length },
      ];

      // Compute top exception drivers dynamically from DB complaint categories
      const categoryCounts: Record<string, number> = {};
      pendingCases.forEach((c) => {
        const cat = c.category || "other";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      const maxCount = Math.max(1, ...Object.values(categoryCounts));

      const exceptionDrivers = Object.entries(categoryCounts)
        .map(([catKey, count]) => ({
          key: catKey,
          label:
            CATEGORY_LABEL_MAP[catKey] ||
            catKey.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
          count,
          percentage: Math.round((count / maxCount) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        cases,
        kpis: {
          pending,
          escalated,
          slaBreaches,
          awaitingAssignment,
          inProgress: cases.filter((c) => c.status === "in_progress").length,
          oldestWaitingMins: Math.max(
            0,
            ...cases.filter((c) => c.status === "unassigned").map((c) => c.ageMins),
          ),
        },
        priorityMix: pMix,
        statusMix: sMix,
        exceptionDrivers,
      };
    },
  });
}
