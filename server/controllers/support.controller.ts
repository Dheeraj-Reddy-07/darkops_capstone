import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { logAudit } from "../services/audit.service";
import { HTTPError } from "../middleware/errors";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Compute SLA state from deadline timestamp */
function getSlaState(deadline: string | null): "on_track" | "at_risk" | "breached" {
  if (!deadline) return "on_track";
  const now = Date.now();
  const dl = new Date(deadline).getTime();
  const remainMs = dl - now;
  if (remainMs < 0) return "breached";
  if (remainMs < 30 * 60 * 1000) return "at_risk"; // < 30 min
  return "on_track";
}

/** Enforce caller is CUSTOMER_SUPPORT or PLATFORM_ADMIN */
function requireSupportRole(auth: any) {
  if (!["CUSTOMER_SUPPORT", "PLATFORM_ADMIN"].includes(auth.user.role)) {
    throw new HTTPError(
      403,
      "FORBIDDEN",
      "Support workspace requires CUSTOMER_SUPPORT or PLATFORM_ADMIN role",
    );
  }
}

// ─── My Stats ───────────────────────────────────────────────────────────────

/**
 * GET /support/me/stats
 * Returns personal KPI counts for the authenticated agent.
 */
export const getMyStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);
    const agentId = auth.user.id;

    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select("id, status, priority, sla_deadline")
      .eq("assigned_to", agentId)
      .not("status", "in", '("resolved","closed")');

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    const now = Date.now();
    let myOpen = 0;
    let urgent = 0;
    let slaAtRisk = 0;
    let overdue = 0;

    for (const t of tickets || []) {
      myOpen++;
      if (t.priority === "P1") urgent++;
      const state = getSlaState(t.sla_deadline);
      if (state === "at_risk") slaAtRisk++;
      if (state === "breached") overdue++;
    }

    res.json({ my_open: myOpen, urgent, sla_at_risk: slaAtRisk, overdue });
  } catch (error) {
    next(error);
  }
};

// ─── My Tickets ─────────────────────────────────────────────────────────────

/**
 * GET /support/me/tickets
 * Returns tickets assigned to the authenticated agent.
 * Supports filters: status, priority, queue, sla_state, q (search)
 */
export const getMyTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);
    const { status, priority, queue, q } = req.query;

    let query = supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at, resolution_notes,
        complaints (complaint_ref, summary, category, order_id, customer_id, store_id),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (id, full_name, email)
      `,
      )
      .eq("assigned_to", auth.user.id)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", String(status));
    if (priority && priority !== "all") query = query.eq("priority", String(priority));
    if (queue && queue !== "all") query = query.eq("queue", String(queue));

    const { data, error } = await query;
    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    let results = data || [];

    // Client-side search
    if (q) {
      const qStr = String(q).toLowerCase();
      results = results.filter(
        (t: any) =>
          t.ticket_number?.toLowerCase().includes(qStr) ||
          t.title?.toLowerCase().includes(qStr) ||
          t.complaints?.complaint_ref?.toLowerCase().includes(qStr) ||
          t.complaints?.order_id?.toLowerCase().includes(qStr) ||
          t.complaints?.summary?.toLowerCase().includes(qStr),
      );
    }

    // Annotate SLA state
    const annotated = results.map((t: any) => ({
      ...t,
      sla_state: getSlaState(t.sla_deadline),
    }));

    res.json({ data: annotated });
  } catch (error) {
    next(error);
  }
};

// ─── Team Tickets ────────────────────────────────────────────────────────────

/**
 * GET /support/team/tickets
 * Returns all support tickets across the team with assignment info.
 * CUSTOMER_SUPPORT and PLATFORM_ADMIN can see all.
 */
export const getTeamTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);
    const { status, priority, queue, q } = req.query;

    let query = supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at,
        complaints (complaint_ref, summary, category),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (id, full_name, email)
      `,
      )
      .not("assigned_to", "is", null)
      .order("created_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", String(status));
    if (priority && priority !== "all") query = query.eq("priority", String(priority));
    if (queue && queue !== "all") query = query.eq("queue", String(queue));

    const { data, error } = await query;
    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    let results = data || [];

    if (q) {
      const qStr = String(q).toLowerCase();
      results = results.filter(
        (t: any) =>
          t.ticket_number?.toLowerCase().includes(qStr) ||
          t.title?.toLowerCase().includes(qStr) ||
          t.complaints?.complaint_ref?.toLowerCase().includes(qStr) ||
          t.complaints?.summary?.toLowerCase().includes(qStr),
      );
    }

    const annotated = results.map((t: any) => ({
      ...t,
      sla_state: getSlaState(t.sla_deadline),
      is_mine: t.assigned_to_profile?.id === auth.user.id,
    }));

    res.json({ data: annotated });
  } catch (error) {
    next(error);
  }
};

// ─── Unassigned Tickets ──────────────────────────────────────────────────────

/**
 * GET /support/unassigned/tickets
 */
export const getUnassignedTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at,
        complaints (complaint_ref, summary, category)
      `,
      )
      .is("assigned_to", null)
      .order("created_at", { ascending: false });

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    const annotated = (data || []).map((t: any) => ({
      ...t,
      sla_state: getSlaState(t.sla_deadline),
    }));

    res.json({ data: annotated });
  } catch (error) {
    next(error);
  }
};

// ─── Resolved Tickets ────────────────────────────────────────────────────────

/**
 * GET /support/me/resolved
 */
export const getMyResolvedTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at, resolution_notes, resolution_time_minutes,
        complaints (complaint_ref, summary, category),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (id, full_name, email),
        resolved_by_profile:profiles!support_tickets_resolved_by_fkey (id, full_name, email)
      `,
      )
      .eq("assigned_to", auth.user.id)
      .in("status", ["resolved", "closed"])
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    res.json({ data: data || [] });
  } catch (error) {
    next(error);
  }
};

// ─── Ticket by ID ────────────────────────────────────────────────────────────

/**
 * GET /support/tickets/:id
 * Returns full ticket with complaint, customer, order, store context.
 * Enforces: assignee OR PLATFORM_ADMIN OR CUSTOMER_SUPPORT.
 */
export const getSupportTicketById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);
    const { id } = req.params;

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        *,
        complaints (
          id, complaint_ref, summary, detail, category, type, priority, status, sla_state,
          order_id, customer_id, store_id, order_value_paise, refund_amount_paise
        ),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (id, full_name, email),
        created_by_profile:profiles!support_tickets_created_by_fkey (id, full_name, email),
        resolved_by_profile:profiles!support_tickets_resolved_by_fkey (id, full_name, email)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new HTTPError(404, "NOT_FOUND", "Support ticket not found");
    }

    // Security: only the assignee or CUSTOMER_SUPPORT/PLATFORM_ADMIN can read
    const isAssignee = (data as any).assigned_to === auth.user.id;
    const isSupportOrAdmin = ["CUSTOMER_SUPPORT", "PLATFORM_ADMIN"].includes(auth.user.role);
    if (!isAssignee && !isSupportOrAdmin) {
      throw new HTTPError(403, "FORBIDDEN", "You do not have access to this ticket");
    }

    // Enrich: fetch order + customer details if complaint has them
    const complaint = (data as any).complaints;
    let order = null;
    let customer = null;
    let store = null;

    if (complaint?.order_id) {
      const { data: orderData } = await supabase
        .from("orders")
        .select("id, placed_at, status, total_amount_paise, item_count, items_preview")
        .eq("id", complaint.order_id)
        .single();
      order = orderData;
    }

    if (complaint?.store_id) {
      const { data: storeData } = await supabase
        .from("stores")
        .select("id, name, city, zone")
        .eq("id", complaint.store_id)
        .single();
      store = storeData;
    }

    // Only show customer name/ref (no PII beyond reference)
    if (complaint?.customer_id) {
      const { data: custData } = await supabase
        .from("customers")
        .select("id, full_name, email")
        .eq("id", complaint.customer_id)
        .single();
      if (custData) {
        customer = { id: custData.id, full_name: custData.full_name, email: custData.email };
      }
    }

    // Fetch attachments
    const { data: attachments } = await supabase
      .from("ticket_attachments")
      .select(
        `
        id, filename, file_type, file_size_bytes, uploaded_at, storage_path,
        uploader:profiles!ticket_attachments_uploaded_by_fkey (full_name)
      `,
      )
      .eq("ticket_id", id)
      .order("uploaded_at", { ascending: true });

    const result = {
      ...(data as any),
      sla_state: getSlaState((data as any).sla_deadline),
      order,
      customer,
      store,
      attachments: attachments || [],
    };

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ─── Ticket Activity ─────────────────────────────────────────────────────────

/**
 * GET /support/tickets/:id/activity
 * Returns chronological activity timeline for a ticket.
 */
export const getTicketActivity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);
    const { id } = req.params;

    // Verify access to ticket
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("assigned_to")
      .eq("id", id)
      .single();

    const isAssignee = ticket?.assigned_to === auth.user.id;
    const isSupportOrAdmin = ["CUSTOMER_SUPPORT", "PLATFORM_ADMIN"].includes(auth.user.role);
    if (!isAssignee && !isSupportOrAdmin) {
      throw new HTTPError(403, "FORBIDDEN", "Access denied");
    }

    const { data, error } = await supabase
      .from("ticket_activity")
      .select(
        `
        id, event_type, payload, created_at,
        actor:profiles!ticket_activity_actor_id_fkey (id, full_name)
      `,
      )
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    res.json({ data: data || [] });
  } catch (error) {
    next(error);
  }
};

// ─── Update Ticket Status ────────────────────────────────────────────────────

/**
 * PATCH /support/tickets/:id/status
 * Valid transitions: open→in_progress, in_progress→awaiting_customer,
 * awaiting_customer→in_progress, any→escalated (if manager)
 * Enforces: only assignee or PLATFORM_ADMIN can change status.
 */
export const updateTicketStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { status, note } = req.body;

    const VALID_STATUSES = [
      "open",
      "in_progress",
      "awaiting_customer",
      "escalated",
      "resolved",
      "closed",
    ];
    if (!status || !VALID_STATUSES.includes(status)) {
      throw new HTTPError(
        400,
        "INVALID_STATUS",
        `Status must be one of: ${VALID_STATUSES.join(", ")}`,
      );
    }

    const { data: ticket, error: fetchErr } = await adminClient
      .from("support_tickets")
      .select("id, status, assigned_to")
      .eq("id", id)
      .single();

    if (fetchErr || !ticket) {
      throw new HTTPError(404, "NOT_FOUND", "Ticket not found");
    }

    // Only assignee or admin can change status
    const isAssignee = ticket.assigned_to === auth.user.id;
    if (!isAssignee && auth.user.role !== "PLATFORM_ADMIN") {
      throw new HTTPError(403, "FORBIDDEN", "Only the ticket assignee can change its status");
    }

    const oldStatus = ticket.status;
    const updatePayload: any = { status, updated_at: new Date().toISOString() };
    if (status === "resolved" || status === "closed") {
      updatePayload.resolved_by = auth.user.id;
      const ageMs = Date.now() - new Date((ticket as any).created_at || Date.now()).getTime();
      updatePayload.resolution_time_minutes = Math.round(ageMs / 60000);
    }

    const { data: updated, error: updateErr } = await adminClient
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw new HTTPError(500, "DATABASE_ERROR", updateErr.message);

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "status_changed",
      payload: { from: oldStatus, to: status, note: note || null },
    });

    // Backfill old history table too
    await adminClient.from("support_ticket_history").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      actor_role: auth.user.role,
      action: "status_updated",
      old_status: oldStatus,
      new_status: status,
      notes: note || null,
    });

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "support_ticket.status_change",
      resourceType: "support_ticket",
      resourceId: String(id),
      metadata: { from: oldStatus, to: status },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─── Assign Ticket ───────────────────────────────────────────────────────────

/**
 * PATCH /support/tickets/:id/assign
 * Assign ticket to self (assign_to_self: true) or to another agent.
 * CUSTOMER_SUPPORT agents can only assign to themselves.
 * PLATFORM_ADMIN can reassign to anyone.
 */
export const assignTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { assign_to_self, agent_id } = req.body;

    // Determine target agent
    let targetAgentId: string;
    if (assign_to_self || !agent_id) {
      targetAgentId = auth.user.id;
    } else {
      // Only PLATFORM_ADMIN can reassign to another agent
      if (auth.user.role !== "PLATFORM_ADMIN") {
        throw new HTTPError(
          403,
          "FORBIDDEN",
          "Only administrators can reassign tickets to other agents",
        );
      }
      targetAgentId = agent_id;
    }

    // Fetch current ticket
    const { data: ticket, error: fetchErr } = await adminClient
      .from("support_tickets")
      .select("id, assigned_to, status")
      .eq("id", id)
      .single();

    if (fetchErr || !ticket) throw new HTTPError(404, "NOT_FOUND", "Ticket not found");

    const oldAssignee = ticket.assigned_to;

    // Get target agent name
    const { data: agentProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", targetAgentId)
      .single();

    const { data: updated, error: updateErr } = await adminClient
      .from("support_tickets")
      .update({ assigned_to: targetAgentId, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw new HTTPError(500, "DATABASE_ERROR", updateErr.message);

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "assigned",
      payload: {
        from: oldAssignee,
        to: targetAgentId,
        to_name: agentProfile?.full_name || "Unknown",
      },
    });

    // Notify new assignee if different from actor
    if (targetAgentId !== auth.user.id) {
      await adminClient.from("notifications").insert({
        recipient_id: targetAgentId,
        title: `You have been assigned ticket ${(ticket as any).ticket_number || id}`,
        meta: JSON.stringify({ ticket_id: id }),
        link_type: "support_ticket",
        link_ref: id,
      });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─── Resolve Ticket ──────────────────────────────────────────────────────────

/**
 * POST /support/tickets/:id/resolve
 * Requires resolution_note. Only assignee or PLATFORM_ADMIN.
 */
export const resolveTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { resolution_note } = req.body;

    if (!resolution_note || String(resolution_note).trim().length < 5) {
      throw new HTTPError(
        400,
        "INVALID_INPUT",
        "Resolution note is required (minimum 5 characters)",
      );
    }

    const { data: ticket, error: fetchErr } = await adminClient
      .from("support_tickets")
      .select("id, assigned_to, status, created_at, ticket_number")
      .eq("id", id)
      .single();

    if (fetchErr || !ticket) throw new HTTPError(404, "NOT_FOUND", "Ticket not found");

    const isAssignee = ticket.assigned_to === auth.user.id;
    if (!isAssignee && auth.user.role !== "PLATFORM_ADMIN") {
      throw new HTTPError(403, "FORBIDDEN", "Only the ticket assignee can resolve it");
    }

    if (ticket.status === "resolved" || ticket.status === "closed") {
      throw new HTTPError(400, "ALREADY_RESOLVED", "Ticket is already resolved");
    }

    const ageMs = Date.now() - new Date(ticket.created_at).getTime();
    const resolutionMinutes = Math.round(ageMs / 60000);

    const { data: updated, error: updateErr } = await adminClient
      .from("support_tickets")
      .update({
        status: "resolved",
        resolution_notes: String(resolution_note).trim(),
        resolved_by: auth.user.id,
        resolution_time_minutes: resolutionMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw new HTTPError(500, "DATABASE_ERROR", updateErr.message);

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "resolved",
      payload: { note: String(resolution_note).trim(), resolution_time_minutes: resolutionMinutes },
    });

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "support_ticket.resolve",
      resourceType: "support_ticket",
      resourceId: String(id),
      metadata: { ticket_number: ticket.ticket_number, resolution_time_minutes: resolutionMinutes },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// ─── Add Note ────────────────────────────────────────────────────────────────

/**
 * POST /support/tickets/:id/notes
 * Add an internal note to the ticket activity.
 */
export const addTicketNote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { note } = req.body;

    if (!note || String(note).trim().length < 1) {
      throw new HTTPError(400, "INVALID_INPUT", "Note content is required");
    }

    const { data, error } = await adminClient
      .from("ticket_activity")
      .insert({
        ticket_id: id,
        actor_id: auth.user.id,
        event_type: "note_added",
        payload: { note: String(note).trim() },
      })
      .select()
      .single();

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    // Update ticket updated_at
    await adminClient
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    res.json(data);
  } catch (error) {
    next(error);
  }
};

// ─── Attachments ─────────────────────────────────────────────────────────────

/**
 * GET /support/tickets/:id/attachments/signed-url
 * Generate a signed upload URL for Supabase Storage.
 */
export const getAttachmentUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { filename, content_type } = req.query;

    if (!filename) throw new HTTPError(400, "INVALID_INPUT", "filename is required");

    // Verify ticket access
    const { data: ticket } = await adminClient
      .from("support_tickets")
      .select("assigned_to")
      .eq("id", id)
      .single();

    if (!ticket) throw new HTTPError(404, "NOT_FOUND", "Ticket not found");

    const isAssignee = ticket.assigned_to === auth.user.id;
    if (!isAssignee && auth.user.role !== "PLATFORM_ADMIN") {
      throw new HTTPError(403, "FORBIDDEN", "Only ticket assignee can upload attachments");
    }

    const safeFilename = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `tickets/${id}/${Date.now()}_${safeFilename}`;

    const { data: signedData, error: signedErr } = await adminClient.storage
      .from("ticket-attachments")
      .createSignedUploadUrl(storagePath);

    if (signedErr)
      throw new HTTPError(
        500,
        "STORAGE_ERROR",
        `Could not generate upload URL: ${signedErr.message}`,
      );

    res.json({
      signed_url: signedData.signedUrl,
      storage_path: storagePath,
      token: signedData.token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /support/tickets/:id/attachments
 * Register an attachment record after successful upload.
 */
export const createAttachmentRecord = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { filename, storage_path, file_type, file_size_bytes } = req.body;

    if (!filename || !storage_path) {
      throw new HTTPError(400, "INVALID_INPUT", "filename and storage_path are required");
    }

    const { data, error } = await adminClient
      .from("ticket_attachments")
      .insert({
        ticket_id: id,
        filename,
        storage_path,
        file_type: file_type || "application/octet-stream",
        file_size_bytes: file_size_bytes || null,
        uploaded_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "attachment_added",
      payload: { filename, file_type },
    });

    // Update ticket updated_at
    await adminClient
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /support/tickets/:id/attachments/:attachmentId/download
 * Returns a signed download URL for a specific attachment.
 */
export const getAttachmentDownloadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id, attachmentId } = req.params;

    // Verify ticket access
    const { data: ticket } = await adminClient
      .from("support_tickets")
      .select("assigned_to")
      .eq("id", id)
      .single();

    const isAssignee = ticket?.assigned_to === auth.user.id;
    if (!isAssignee && auth.user.role !== "PLATFORM_ADMIN") {
      throw new HTTPError(403, "FORBIDDEN", "Access denied");
    }

    const { data: attachment } = await adminClient
      .from("ticket_attachments")
      .select("storage_path, filename")
      .eq("id", attachmentId)
      .eq("ticket_id", id)
      .single();

    if (!attachment) throw new HTTPError(404, "NOT_FOUND", "Attachment not found");

    const { data: signedData, error: signedErr } = await adminClient.storage
      .from("ticket-attachments")
      .createSignedUrl(attachment.storage_path, 3600); // 1 hour

    if (signedErr) throw new HTTPError(500, "STORAGE_ERROR", signedErr.message);

    res.json({ signed_url: signedData.signedUrl, filename: attachment.filename });
  } catch (error) {
    next(error);
  }
};

// ─── Legacy endpoints (keep for backwards compatibility) ────────────────────

export const getSupportTickets = async (req: Request, res: Response, next: NextFunction) => {
  // Redirect to getTeamTickets for CUSTOMER_SUPPORT, getMyTickets otherwise
  return getTeamTickets(req, res, next);
};

export const getFailedAutomationQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const supabase = createSupabaseServerClient(req, res);

    const { data, error } = await supabase
      .from("failed_automation")
      .select(
        `
        *,
        complaints (complaint_ref, summary, category, type, store_id)
      `,
      )
      .is("resolved_at", null)
      .order("urgency_score", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    res.json({ data: data || [] });
  } catch (error) {
    next(error);
  }
};

export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { complaint_id, queue, priority, title } = req.body;

    const ticketNumber = `TKT-${Date.now()}`;
    const assignedTo = auth.user.id; // Assign to creator by default

    const slaMinutes: Record<string, number> = { P1: 15, P2: 30, P3: 120, P4: 480 };
    const slaDeadline = new Date();
    slaDeadline.setMinutes(slaDeadline.getMinutes() + (slaMinutes[priority as string] || 120));

    // Get complaint summary for title if not provided
    let ticketTitle = title;
    if (!ticketTitle && complaint_id) {
      const { data: complaint } = await adminClient
        .from("complaints")
        .select("summary")
        .eq("id", complaint_id)
        .single();
      ticketTitle = complaint?.summary || "Support ticket";
    }

    const { data, error } = await adminClient
      .from("support_tickets")
      .insert({
        ticket_number: ticketNumber,
        title: ticketTitle,
        complaint_id,
        assigned_to: assignedTo,
        status: "open",
        priority: priority || "P3",
        queue: queue || "general",
        sla_deadline: slaDeadline.toISOString(),
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    await adminClient.from("ticket_activity").insert({
      ticket_id: data.id,
      actor_id: auth.user.id,
      event_type: "created",
      payload: { title: ticketTitle, assigned_to: assignedTo },
    });

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "support_ticket.create",
      resourceType: "support_ticket",
      resourceId: data.id,
      metadata: { ticket_number: ticketNumber, queue, priority },
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

export const updateSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  // Delegate to updateTicketStatus for backwards compat
  const { status } = req.body;
  req.body = { status, note: req.body.notes };
  return updateTicketStatus(req, res, next);
};

export const getTicketHistory = async (req: Request, res: Response, next: NextFunction) => {
  // Redirect to new activity endpoint
  return getTicketActivity(req, res, next);
};

export const resolveFailedAutomation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { notes, action_taken } = req.body;

    const { data, error } = await adminClient
      .from("failed_automation")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: auth.user.id,
        notes:
          typeof notes === "string"
            ? notes
            : typeof action_taken === "string"
              ? action_taken
              : undefined,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "failed_automation.resolve",
      resourceType: "failed_automation",
      resourceId: String(id),
      metadata: {},
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
};
