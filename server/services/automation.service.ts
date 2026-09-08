// Automation Service for complaint processing and routing
// Implements the full workflow: NLP analysis → routing → validation → auto-processing or escalation

import { createSupabaseServiceRoleClient } from "../lib/supabase";
import {
  analyzeComplaint,
  validateRefund,
  validateReorder,
  calculatePriority,
  calculateSLADeadline,
} from "./nlp.service";
import { logAudit } from "./audit.service";

export interface AutomationResult {
  success: boolean;
  routed_to?: string;
  action_taken?: string;
  failed_automation_id?: string;
  support_ticket_id?: string;
  error?: string;
}

export async function processComplaint(complaintId: string): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // 1. Fetch complaint with related data
    const { data: complaint, error: fetchError } = await adminClient
      .from("complaints")
      .select(
        `
        *,
        orders (total_amount_paise, placed_at),
        customers (prior_claims_90d, refund_history_paise)
      `,
      )
      .eq("id", complaintId)
      .single();

    if (fetchError || !complaint) {
      throw new Error(`Complaint not found: ${fetchError?.message}`);
    }

    // 2. Run NLP analysis
    const nlpAnalysis = analyzeComplaint(complaint.summary, complaint.detail);

    // 3. Update complaint with NLP results
    await adminClient
      .from("complaints")
      .update({
        category: nlpAnalysis.category,
        type: nlpAnalysis.type,
        urgency_score: nlpAnalysis.urgency_score,
        sentiment: nlpAnalysis.sentiment,
        automated_routing: true,
        automation_result: "NLP analysis completed",
      })
      .eq("id", complaintId);

    // 4. Route based on complaint type
    const order = complaint.orders as any;
    const customer = complaint.customers as any;

    switch (nlpAnalysis.type) {
      case "refund":
        return await processRefund(complaintId, complaint, order, customer, nlpAnalysis);

      case "reorder":
        return await processReorder(complaintId, complaint, order, customer, nlpAnalysis);

      case "operational_investigation":
        return await processOperational(complaintId, complaint, nlpAnalysis);

      default:
        // Fallback to manual review
        return await escalateToSupport(
          complaintId,
          complaint,
          nlpAnalysis,
          "Unknown complaint type",
        );
    }
  } catch (error) {
    console.error("[Automation] Error processing complaint:", error);

    // Log failed automation
    await logFailedAutomation(
      complaintId,
      "processing_error",
      "General processing error",
      50, // medium urgency
      "neutral",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function processRefund(
  complaintId: string,
  complaint: any,
  order: any,
  customer: any,
  nlpAnalysis: any,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // Validate refund
    const validation = validateRefund(
      order?.total_amount_paise || 0,
      complaint.refund_amount_paise || 0,
      customer?.refund_history_paise || 0,
      customer?.prior_claims_90d || 0,
    );

    if (validation.can_auto_approve) {
      // Auto-approve refund
      await adminClient
        .from("refund_requests")
        .update({ status: "approved" })
        .eq("complaint_id", complaintId);

      await adminClient
        .from("complaints")
        .update({
          status: "resolved",
          automation_result: "Auto-approved refund",
        })
        .eq("id", complaintId);

      // Update PulseScore for the store (simplified - in production would trigger full recalculation)
      if (complaint.store_id) {
        await updateStorePulse(complaint.store_id, -2); // Small penalty for refund
      }

      await logAudit({
        actorId: "system",
        actorRole: "automation",
        action: "refund.auto_approve",
        resourceType: "complaint",
        resourceId: complaintId,
        metadata: { amount: complaint.refund_amount_paise },
      });

      return {
        success: true,
        routed_to: "auto_approved",
        action_taken: "Refund auto-approved",
      };
    } else {
      // Escalate to support
      return await escalateToSupport(
        complaintId,
        complaint,
        nlpAnalysis,
        validation.reason || "Refund validation failed",
      );
    }
  } catch (error) {
    return await logFailedAutomation(
      complaintId,
      "refund_validation",
      "Refund validation error",
      nlpAnalysis.urgency_score,
      nlpAnalysis.sentiment,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

async function processReorder(
  complaintId: string,
  complaint: any,
  order: any,
  customer: any,
  nlpAnalysis: any,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // Calculate order age in hours
    const orderAgeHours = order
      ? (Date.now() - new Date(order.placed_at).getTime()) / (1000 * 60 * 60)
      : 999;

    // Validate reorder
    const validation = validateReorder(orderAgeHours, customer?.prior_claims_90d || 0);

    if (validation.can_auto_approve) {
      // Auto-approve reorder (create new order)
      // In production, this would call the order service
      await adminClient
        .from("complaints")
        .update({
          status: "resolved",
          automation_result: "Auto-approved reorder",
        })
        .eq("id", complaintId);

      await logAudit({
        actorId: "system",
        actorRole: "automation",
        action: "reorder.auto_approve",
        resourceType: "complaint",
        resourceId: complaintId,
        metadata: { original_order_id: complaint.order_id },
      });

      return {
        success: true,
        routed_to: "auto_approved",
        action_taken: "Reorder auto-approved",
      };
    } else {
      // Escalate to support
      return await escalateToSupport(
        complaintId,
        complaint,
        nlpAnalysis,
        validation.reason || "Reorder validation failed",
      );
    }
  } catch (error) {
    return await logFailedAutomation(
      complaintId,
      "reorder_validation",
      "Reorder validation error",
      nlpAnalysis.urgency_score,
      nlpAnalysis.sentiment,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

async function processOperational(
  complaintId: string,
  complaint: any,
  nlpAnalysis: any,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // Route to store manager for investigation
    await adminClient
      .from("complaints")
      .update({
        status: "assigned",
        automation_result: "Routed to store manager",
      })
      .eq("id", complaintId);

    // Notify store manager
    if (complaint.store_id) {
      await adminClient.from("notifications").insert({
        recipient_id: null, // Will be set to store manager
        title: `Operational issue at ${complaint.store_id}`,
        meta: `Complaint ${complaint.complaint_ref} requires investigation`,
        link_type: "complaint",
        link_ref: complaintId,
      });
    }

    await logAudit({
      actorId: "system",
      actorRole: "automation",
      action: "complaint.route_to_store_manager",
      resourceType: "complaint",
      resourceId: complaintId,
      metadata: { store_id: complaint.store_id },
    });

    return {
      success: true,
      routed_to: "store_manager",
      action_taken: "Routed to store manager for investigation",
    };
  } catch (error) {
    return await logFailedAutomation(
      complaintId,
      "operational_routing",
      "Store manager routing error",
      nlpAnalysis.urgency_score,
      nlpAnalysis.sentiment,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

async function escalateToSupport(
  complaintId: string,
  complaint: any,
  nlpAnalysis: any,
  reason: string,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // Calculate priority and SLA
    const priority = calculatePriority(nlpAnalysis.urgency_score, nlpAnalysis.sentiment);
    const slaDeadline = calculateSLADeadline(priority, new Date());

    // Determine queue based on complaint type
    let queue = "general";
    if (complaint.type === "refund") queue = "refunds";
    if (complaint.type === "reorder") queue = "reorders";
    if (complaint.category === "late_delivery" || complaint.category === "quality_issue")
      queue = "operational";

    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}`;

    // Auto-assign to available support agent
    const assignedTo = await autoAssignSupportAgent(queue);

    // Create support ticket
    const { data: ticket, error: ticketError } = await adminClient
      .from("support_tickets")
      .insert({
        ticket_number: ticketNumber,
        complaint_id: complaintId,
        assigned_to: assignedTo,
        status: "open",
        priority,
        queue,
        sla_deadline: slaDeadline.toISOString(),
        created_by: "system",
      })
      .select()
      .single();

    if (ticketError) throw ticketError;

    // Update complaint status
    await adminClient
      .from("complaints")
      .update({
        status: "assigned",
        automation_result: `Escalated to support: ${reason}`,
      })
      .eq("id", complaintId);

    // Log ticket creation
    await adminClient.from("support_ticket_history").insert({
      ticket_id: ticket.id,
      actor_id: "system",
      actor_role: "automation",
      action: "ticket_created",
      new_status: "open",
      new_assigned_to: assignedTo,
      notes: reason,
    });

    // Log failed automation
    await logFailedAutomation(
      complaintId,
      "escalation_to_support",
      reason,
      nlpAnalysis.urgency_score,
      nlpAnalysis.sentiment,
    );

    // Notify assigned agent
    if (assignedTo) {
      await adminClient.from("notifications").insert({
        recipient_id: assignedTo,
        title: `New ticket: ${ticketNumber}`,
        meta: `Priority ${priority} ticket assigned`,
        link_type: "support_ticket",
        link_ref: ticket.id,
      });
    }

    await logAudit({
      actorId: "system",
      actorRole: "automation",
      action: "complaint.escalate_to_support",
      resourceType: "complaint",
      resourceId: complaintId,
      metadata: { ticket_id: ticket.id, reason },
    });

    return {
      success: true,
      routed_to: "customer_support",
      action_taken: `Escalated to support: ${reason}`,
      support_ticket_id: ticket.id,
    };
  } catch (error) {
    console.error("[Automation] Error escalating to support:", error);

    // Log failed automation
    await logFailedAutomation(
      complaintId,
      "support_escalation",
      "Support escalation error",
      nlpAnalysis.urgency_score,
      nlpAnalysis.sentiment,
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function autoAssignSupportAgent(queue: string): Promise<string | null> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // Find available support agents with lowest workload
    const { data: agents } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "CUSTOMER_SUPPORT")
      .eq("is_active", true);

    if (!agents || agents.length === 0) {
      return null; // No available agents
    }

    // Count open tickets for each agent
    const agentWorkloads = await Promise.all(
      agents.map(async (agent) => {
        const { count } = await adminClient
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", agent.id)
          .in("status", ["open", "in_progress"]);

        return {
          agentId: agent.id,
          workload: count || 0,
        };
      }),
    );

    // Sort by workload and pick the least busy agent
    agentWorkloads.sort((a, b) => a.workload - b.workload);

    return agentWorkloads[0]?.agentId || null;
  } catch (error) {
    console.error("[Automation] Error auto-assigning agent:", error);
    return null;
  }
}

async function logFailedAutomation(
  complaintId: string,
  failureStep: string,
  failureReason: string,
  urgencyScore: number,
  sentiment: string,
  error?: string,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    const { data: failedRecord } = await adminClient
      .from("failed_automation")
      .insert({
        complaint_id: complaintId,
        failure_reason: failureReason,
        failure_step: failureStep,
        urgency_score: urgencyScore,
        sentiment: sentiment,
      })
      .select()
      .single();

    return {
      success: false,
      failed_automation_id: failedRecord?.id,
      error: error || failureReason,
    };
  } catch (error) {
    console.error("[Automation] Error logging failed automation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function updateStorePulse(storeId: string, adjustment: number): Promise<void> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // Get current pulse score
    const { data: pulse } = await adminClient
      .from("pulse_scores")
      .select("score")
      .eq("store_id", storeId)
      .single();

    if (pulse) {
      const newScore = Math.max(0, Math.min(100, pulse.score + adjustment));

      await adminClient.from("pulse_scores").update({ score: newScore }).eq("store_id", storeId);
    }
  } catch (error) {
    console.error("[Automation] Error updating store pulse:", error);
  }
}
