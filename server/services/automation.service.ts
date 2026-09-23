// Automation Service for DarkOps complaint processing and routing
// Workflow: Intake → Classification → Requested Resolution → Eligibility Assessment → Decision → Execution Handoff or Agent Escalation

import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { analyzeComplaint, calculatePriority, calculateSLADeadline } from "./nlp.service";
import { logAudit } from "./audit.service";
import { evaluateResolutionEligibility, ResolutionResult } from "./resolution.service";
import { createExecutionHandoff, dispatchHandoff } from "./handoff.service";

export interface AutomationResult {
  success: boolean;
  routed_to?: string;
  action_taken?: string;
  failed_automation_id?: string;
  support_ticket_id?: string;
  execution_handoff_id?: string;
  error?: string;
}

export async function processComplaint(complaintId: string): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    // 1. Fetch complaint with related order and customer history
    const { data: complaint, error: fetchError } = await adminClient
      .from("complaints")
      .select(
        `
        *,
        orders (id, total_amount_paise, placed_at),
        customers (id, prior_claims_90d)
      `,
      )
      .eq("id", complaintId)
      .single();

    if (fetchError || !complaint) {
      throw new Error(`Complaint not found: ${fetchError?.message}`);
    }

    // 2. Run deterministic NLP analysis
    const nlpAnalysis = analyzeComplaint(complaint.summary, complaint.detail);
    const order = complaint.orders as any;
    const customer = complaint.customers as any;
    const requestedResolution = complaint.requested_resolution || "SUPPORT_REVIEW";

    // 3. Evaluate Resolution Eligibility using ResolutionDecisionService
    const evalResult: ResolutionResult = evaluateResolutionEligibility(
      complaint,
      order,
      customer,
      nlpAnalysis,
      requestedResolution,
    );

    // 4. Update complaint with NLP and Resolution Decision metadata
    const nowIso = new Date().toISOString();
    await adminClient
      .from("complaints")
      .update({
        category: nlpAnalysis.category,
        type: nlpAnalysis.type,
        urgency_score: nlpAnalysis.urgency_score,
        sentiment: nlpAnalysis.sentiment,
        automated_routing: true,
        resolution_decision: evalResult.resolution_type,
        resolution_decision_reason: evalResult.decision_reason,
        resolution_decided_at: evalResult.auto_eligible ? nowIso : null,
        automation_result: evalResult.decision_reason,
      })
      .eq("id", complaintId);

    // 5. If auto-eligible and approved, execute automated resolution and handoff
    if (evalResult.auto_eligible && evalResult.decision_status === "APPROVED") {
      return await executeAutoApproval(complaintId, complaint, order, evalResult, nlpAnalysis);
    } else {
      // 6. Otherwise route to human Support Agent queue
      return await escalateToAgentQueue(
        complaintId,
        complaint,
        nlpAnalysis,
        evalResult.decision_reason,
      );
    }
  } catch (error) {
    console.error("[Automation] Error processing complaint:", error);

    await logFailedAutomation(
      complaintId,
      "processing_error",
      "General processing error",
      50,
      "neutral",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handles auto-approval workflow for eligible complaints:
 * Updates status, creates durable signed execution handoff, closes ticket, notifies customer.
 */
async function executeAutoApproval(
  complaintId: string,
  complaint: any,
  order: any,
  evalResult: ResolutionResult,
  nlpAnalysis: any,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();
  const resolutionText = `${evalResult.decision_reason}`;

  // Update complaint to resolved
  await adminClient
    .from("complaints")
    .update({
      status: "resolved",
      resolution: resolutionText,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", complaintId);

  // Record status history
  try {
    await adminClient.from("complaint_status_history").insert({
      complaint_id: complaintId,
      from_status: "unassigned",
      to_status: "resolved",
      changed_by: null,
      note: `Auto-resolved by DarkOps: ${evalResult.decision_reason}`,
    });
  } catch (err) {
    console.error("[Automation] Status history error:", err);
  }

  // Create & Dispatch Execution Handoff if financial or replacement execution is required
  let handoffId: string | undefined;
  if (
    evalResult.execution_required &&
    (evalResult.resolution_type === "REFUND" || evalResult.resolution_type === "REPLACEMENT")
  ) {
    try {
      const handoff = await createExecutionHandoff({
        complaintId,
        orderId: complaint.order_id,
        resolutionType: evalResult.resolution_type,
        reason: evalResult.decision_reason,
        metadata: {
          requested_resolution: complaint.requested_resolution,
          order_value_paise: order?.total_amount_paise || 0,
          confidence: nlpAnalysis.confidence,
        },
      });

      // Dispatch simulated handoff to upstream commerce platform
      const dispatched = await dispatchHandoff(handoff.id);
      handoffId = dispatched.id;
    } catch (err) {
      console.error("[Automation] Execution handoff error:", err);
    }
  }

  // Close linked support ticket if present
  if (complaint.ticket_id) {
    try {
      await adminClient
        .from("support_tickets")
        .update({ status: "closed", priority: "P3" })
        .eq("id", complaint.ticket_id);

      await adminClient.from("ticket_activity").insert({
        ticket_id: complaint.ticket_id,
        event_type: "auto_resolved",
        payload: {
          reason: evalResult.decision_reason,
          resolution_type: evalResult.resolution_type,
          handoff_id: handoffId,
        },
      });
    } catch (err) {
      console.error("[Automation] Error closing ticket:", err);
    }
  }

  // Notify customer
  if (complaint.customer_id) {
    const { data: customerProfile } = await adminClient
      .from("customers")
      .select("profile_id")
      .eq("id", complaint.customer_id)
      .maybeSingle();

    if (customerProfile?.profile_id) {
      try {
        const title =
          evalResult.resolution_type === "REFUND"
            ? "Refund approved by DarkOps"
            : evalResult.resolution_type === "REPLACEMENT"
              ? "Replacement approved by DarkOps"
              : "Your issue has been resolved";

        await adminClient.from("notifications").insert({
          recipient_id: customerProfile.profile_id,
          title,
          meta: JSON.stringify({
            complaint_ref: complaint.complaint_ref,
            resolution_type: evalResult.resolution_type,
            status: "APPROVED",
          }),
          link_type: "complaint",
          link_ref: complaintId,
        });
      } catch (err) {
        console.error("[Automation] Notification error:", err);
      }
    }
  }

  // Update store pulse score
  if (complaint.store_id) {
    await updateStorePulse(complaint.store_id, -2);
  }

  const auditActionMap: Record<string, any> = {
    REFUND: "resolution.auto_approved_refund",
    REPLACEMENT: "resolution.auto_approved_replacement",
    SUPPORT_REVIEW: "resolution.auto_approved_support_review",
    NO_ACTION: "resolution.auto_approved_no_action",
  };
  const actionName =
    auditActionMap[evalResult.resolution_type] || "resolution.auto_approved_refund";

  await logAudit({
    actorId: "00000000-0000-0000-0000-000000000000",
    actorRole: "automation",
    action: actionName,
    resourceType: "complaint",
    resourceId: complaintId,
    metadata: {
      resolution_type: evalResult.resolution_type,
      requested_resolution: complaint.requested_resolution,
      handoff_id: handoffId,
    },
  });

  return {
    success: true,
    routed_to: "auto_approved",
    action_taken: `Auto-approved decision: ${evalResult.resolution_type}`,
    execution_handoff_id: handoffId,
  };
}

/**
 * Escalates complaint to agent queue when automation criteria are not met.
 */
async function escalateToAgentQueue(
  complaintId: string,
  complaint: any,
  nlpAnalysis: any,
  reason: string,
): Promise<AutomationResult> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    const priority = calculatePriority(nlpAnalysis.urgency_score, nlpAnalysis.sentiment);
    const slaDeadline = calculateSLADeadline(priority, new Date());

    let queue = "general";
    if (complaint.type === "refund" || complaint.requested_resolution === "REFUND")
      queue = "refunds";
    else if (complaint.type === "reorder" || complaint.requested_resolution === "REPLACEMENT")
      queue = "reorders";
    else if (complaint.category === "late_delivery" || complaint.category === "quality_issue")
      queue = "operational";

    const assignedTo = await autoAssignSupportAgent(queue);

    await adminClient
      .from("complaints")
      .update({
        status: "assigned",
        priority,
        automation_result: `Escalated to agent queue: ${reason}`,
        sla_due_at: slaDeadline.toISOString(),
      })
      .eq("id", complaintId);

    try {
      await adminClient.from("complaint_status_history").insert({
        complaint_id: complaintId,
        from_status: "unassigned",
        to_status: "assigned",
        changed_by: null,
        note: reason,
      });
    } catch {
      /* ignore */
    }

    let ticketId = complaint.ticket_id || null;

    if (ticketId) {
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
        console.error("[Automation] Ticket update error:", err);
        ticketId = null;
      }
    }

    if (!ticketId) {
      const fallbackTicketNumber = `TKT-${Date.now()}-FA`;
      try {
        const { data: fallbackTicket } = await adminClient
          .from("support_tickets")
          .insert({
            ticket_number: fallbackTicketNumber,
            complaint_id: complaintId,
            title: complaint.summary,
            assigned_to: assignedTo,
            status: "open",
            priority,
            queue,
            sla_deadline: slaDeadline.toISOString(),
          })
          .select("id")
          .single();
        if (fallbackTicket?.id) {
          await adminClient.from("ticket_activity").insert({
            ticket_id: fallbackTicket.id,
            event_type: "created",
            payload: { reason, source: "automation_fallback" },
          });
          ticketId = fallbackTicket.id;
        }
      } catch (err) {
        console.error("[Automation] Fallback ticket error:", err);
      }
    }

    if (assignedTo) {
      try {
        await adminClient.from("notifications").insert({
          recipient_id: assignedTo,
          title: `New case: ${complaint.complaint_ref || complaintId}`,
          meta: JSON.stringify({ priority, queue, reason }),
          link_type: "support_ticket",
          link_ref: ticketId,
        });
      } catch {
        /* ignore */
      }
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
    console.error("[Automation] Escalation error:", error);

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

/**
 * Load-balanced auto-assignment: returns the active support agent with the
 * fewest active (non-resolved/closed) tickets. Shared by the automation
 * escalation path and manual ticket creation so every new ticket lands with the
 * least-busy agent. `queue` is accepted for future queue-aware routing but is
 * not required for the workload calculation today.
 */
export async function autoAssignSupportAgent(_queue?: string): Promise<string | null> {
  const adminClient = createSupabaseServiceRoleClient();

  try {
    const { data: agents } = await adminClient
      .from("profiles")
      .select("id")
      .eq("role", "CUSTOMER_SUPPORT")
      .eq("is_active", true)
      // Exclude the legacy fraud "Risk Analyst" account from auto-assignment.
      .neq("email", "fraud@darkops.com");

    if (!agents || agents.length === 0) return null;

    const agentWorkloads = await Promise.all(
      agents.map(async (agent: any) => {
        const { count } = await adminClient
          .from("support_tickets")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", agent.id)
          .not("status", "in", '("resolved","closed")');

        return {
          agentId: agent.id,
          workload: count || 0,
        };
      }),
    );

    // Least busy first; stable tie-break by id keeps distribution deterministic.
    agentWorkloads.sort((a, b) => a.workload - b.workload || a.agentId.localeCompare(b.agentId));
    return agentWorkloads[0]?.agentId || null;
  } catch (error) {
    console.error("[Automation] Auto-assign agent error:", error);
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
