// Automation Service for complaint processing and routing
// Implements the full workflow: NLP analysis → routing → validation → auto-processing or escalation

import { createSupabaseServiceRoleClient } from "../lib/supabase";
import {
  analyzeComplaint,
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
        customers (prior_claims_90d)
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
        return await escalateToAgentQueue(
          complaintId,
          complaint,
          nlpAnalysis,
          "Unknown complaint type – manual review required",
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
    const orderAmountPaise = order?.total_amount_paise || 0;
    const priorClaims = customer?.prior_claims_90d || 0;
    const confidence = nlpAnalysis.confidence || 0;

    // ── AUTO-RESOLUTION DECISION GATE (DarkOps final spec) ───────────────────
    // Auto-resolve ONLY IF ALL THREE conditions pass:
    //   1. History clean: prior_claims_90d <= 2
    //   2. Amount <= threshold: order amount <= Rs 500 (50000 paise)
    //   3. NLP confidence >= threshold: confidence >= 40
    const historyClean = priorClaims <= 2;
    const amountBelowThreshold = orderAmountPaise <= 50000; // Rs 500
    const confidenceAboveThreshold = confidence >= 40;
    const canAutoResolve = historyClean && amountBelowThreshold && confidenceAboveThreshold;

    if (canAutoResolve) {
      const resolution = `Refund auto-approved. Amount: Rs ${(orderAmountPaise / 100).toFixed(2)}. Your refund will be credited within 2-3 business days.`;

      await adminClient
        .from("complaints")
        .update({
          status: "resolved",
          automation_result: "Auto-approved refund",
          resolution,
        })
        .eq("id", complaintId);

      // Status history
      try {
        await adminClient.from("complaint_status_history").insert({
          complaint_id: complaintId,
          from_status: "unassigned",
          to_status: "resolved",
          changed_by: null,
          note: `Auto-resolved: refund approved (confidence: ${confidence}, prior_claims: ${priorClaims}, amount: Rs ${orderAmountPaise / 100})`,
        });
      } catch {}

      // Close the existing support ticket (don't create a new one)
      if (complaint.ticket_id) {
        try {
          await adminClient
            .from("support_tickets")
            .update({ status: "closed", priority: "P3" })
            .eq("id", complaint.ticket_id);

          await adminClient.from("ticket_activity").insert({
            ticket_id: complaint.ticket_id,
            event_type: "auto_resolved",
            payload: { reason: "Refund auto-approved by automation engine", resolution },
          });
        } catch (err) {
          console.error("[Automation] Error closing ticket:", err);
        }
      }

      // Notify customer via profile lookup
      if (complaint.customer_id) {
        const { data: customerProfile } = await adminClient
          .from("customers")
          .select("profile_id")
          .eq("id", complaint.customer_id)
          .maybeSingle();

        if (customerProfile?.profile_id) {
          try {
            await adminClient.from("notifications").insert({
              recipient_id: customerProfile.profile_id,
              title: "Your complaint has been resolved",
              meta: JSON.stringify({ complaint_ref: complaint.complaint_ref, resolution: "Refund approved" }),
              link_type: "complaint",
              link_ref: complaintId,
            });
          } catch {}
        }
      }

      // Update PulseScore for the store
      if (complaint.store_id) {
        await updateStorePulse(complaint.store_id, -2);
      }

      await logAudit({
        actorId: "00000000-0000-0000-0000-000000000000",
        actorRole: "automation",
        action: "refund.auto_approve",
        resourceType: "complaint",
        resourceId: complaintId,
        metadata: { amount_paise: orderAmountPaise, confidence, prior_claims: priorClaims },
      });

      return {
        success: true,
        routed_to: "auto_approved",
        action_taken: "Refund auto-approved",
      };
    } else {
      // Build escalation reason for ops team visibility
      const reason = !historyClean
        ? `Customer has ${priorClaims} prior claims in 90 days (threshold: <=2)`
        : !amountBelowThreshold
          ? `Order amount Rs ${orderAmountPaise / 100} exceeds auto-approve threshold of Rs 500`
          : `NLP confidence ${confidence} below threshold of 40`;

      return await escalateToAgentQueue(complaintId, complaint, nlpAnalysis, reason);
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
    const priorClaims = customer?.prior_claims_90d || 0;
    const canAutoApprove = orderAgeHours <= 24 && priorClaims <= 5;

    if (canAutoApprove) {
      // Auto-approve reorder
      await adminClient
        .from("complaints")
        .update({
          status: "resolved",
          automation_result: "Auto-approved reorder",
          resolution: "Reorder request approved. A replacement order will be dispatched within 30 minutes.",
        })
        .eq("id", complaintId);

      // Status history
      try {
        await adminClient.from("complaint_status_history").insert({
          complaint_id: complaintId,
          from_status: "unassigned",
          to_status: "resolved",
          changed_by: null,
          note: `Auto-resolved: reorder approved (order age: ${orderAgeHours.toFixed(1)}h, prior_claims: ${priorClaims})`,
        });
      } catch {}

      // Close the existing support ticket
      if (complaint.ticket_id) {
        try {
          await adminClient
            .from("support_tickets")
            .update({ status: "closed" })
            .eq("id", complaint.ticket_id);
          await adminClient.from("ticket_activity").insert({
            ticket_id: complaint.ticket_id,
            event_type: "auto_resolved",
            payload: { reason: "Reorder auto-approved by automation engine" },
          });
        } catch {}
      }

      await logAudit({
        actorId: "00000000-0000-0000-0000-000000000000",
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
      const reason = orderAgeHours > 24
        ? `Reorder window expired (order is ${orderAgeHours.toFixed(0)}h old, limit is 24h)`
        : `Customer has ${priorClaims} prior claims (threshold: <=5)`;

      return await escalateToAgentQueue(complaintId, complaint, nlpAnalysis, reason);
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
  // Operational complaints always go to agent queue for investigation
  // (we cannot auto-resolve operational issues like late delivery / wrong item)
  return await escalateToAgentQueue(
    complaintId,
    complaint,
    nlpAnalysis,
    "Operational complaint requires agent investigation",
  );
}

/**
 * Escalate to the agent queue:
 * - Updates the complaint status to "assigned"
 * - Updates (not creates) the existing support ticket with proper priority, queue, and SLA
 * - Logs automation decision
 */
async function escalateToAgentQueue(
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
    else if (complaint.type === "reorder") queue = "reorders";
    else if (complaint.category === "late_delivery" || complaint.category === "quality_issue")
      queue = "operational";

    // Auto-assign to available support agent
    const assignedTo = await autoAssignSupportAgent(queue);

    // Update complaint status + store SLA deadline on the complaint (sla_due_at is the schema column)
    await adminClient
      .from("complaints")
      .update({
        status: "assigned",
        priority,
        automation_result: `Escalated to agent queue: ${reason}`,
        sla_due_at: slaDeadline.toISOString(),
      })
      .eq("id", complaintId);

    // Status history entry
    try {
      await adminClient.from("complaint_status_history").insert({
        complaint_id: complaintId,
        from_status: "unassigned",
        to_status: "assigned",
        changed_by: null,
        note: reason,
      });
    } catch {}

    let ticketId = complaint.ticket_id || null;

    if (ticketId) {
      // UPDATE existing ticket with correct priority, queue, SLA, and agent assignment
      try {
        await adminClient
          .from("support_tickets")
          .update({
            priority,
            queue,
            sla_deadline: slaDeadline.toISOString(),
            assigned_to: assignedTo,
            status: "open",
          })
          .eq("id", ticketId);

        await adminClient.from("ticket_activity").insert({
          ticket_id: ticketId,
          event_type: "automation_routed",
          payload: { reason, priority, queue, assigned_to: assignedTo },
        });
      } catch (err) {
        console.error("[Automation] Error updating existing ticket:", err);
        ticketId = null; // Fall through to create new one if update failed
      }
    }

    if (!ticketId) {
      // Fallback: create a ticket if one doesn't exist yet
      const fallbackTicketNumber = `TKT-${Date.now()}-FA`;
      try {
        const { data: fallbackTicket } = await adminClient.from("support_tickets").insert({
          ticket_number: fallbackTicketNumber,
          complaint_id: complaintId,
          title: complaint.summary,
          assigned_to: assignedTo,
          status: "open",
          priority,
          queue,
          sla_deadline: slaDeadline.toISOString(),
        }).select("id").single();
        if (fallbackTicket?.id) {
          await adminClient.from("ticket_activity").insert({
            ticket_id: fallbackTicket.id,
            event_type: "created",
            payload: { reason, source: "automation_fallback" },
          });
          ticketId = fallbackTicket.id;
        }
      } catch (err) {
        console.error("[Automation] Error creating fallback ticket:", err);
      }
    }

    // Notify assigned agent
    if (assignedTo) {
      try {
        await adminClient.from("notifications").insert({
          recipient_id: assignedTo,
          title: `New case: ${complaint.complaint_ref || complaintId}`,
          meta: JSON.stringify({ priority, queue, reason }),
          link_type: "support_ticket",
          link_ref: ticketId,
        });
      } catch {}
    }

    await logAudit({
      actorId: "system",
      actorRole: "automation",
      action: "complaint.escalate_to_agent_queue",
      resourceType: "complaint",
      resourceId: complaintId,
      metadata: { ticket_id: ticketId, reason, priority, queue },
    });

    return {
      success: true,
      routed_to: "agent_queue",
      action_taken: `Escalated to agent queue (${queue}) – ${reason}`,
      support_ticket_id: ticketId,
    };
  } catch (error) {
    console.error("[Automation] Error escalating to agent queue:", error);

    await logFailedAutomation(
      complaintId,
      "agent_queue_escalation",
      "Agent queue escalation error",
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
