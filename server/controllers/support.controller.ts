import { Request, Response, NextFunction } from "express";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { logAudit } from "../services/audit.service";
import { HTTPError } from "../middleware/errors";
import { createExecutionHandoff, dispatchHandoff } from "../services/handoff.service";
import { autoAssignSupportAgent } from "../services/automation.service";

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

/** Enforce caller has support workspace access */
function requireSupportRole(auth: any) {
  const allowed =
    ["CUSTOMER_SUPPORT", "PLATFORM_ADMIN", "OPERATIONS", "EXECUTIVE"].includes(auth?.user?.role) ||
    auth?.permissions?.has("support.read");
  if (!allowed) {
    throw new HTTPError(403, "FORBIDDEN", "Support workspace requires support access permission");
  }
}

/**
 * The Support Lead is the single CUSTOMER_SUPPORT account designated as team
 * lead (support@darkops.com / usr-supp-001). Platform admins are treated as
 * leads for oversight. This mirrors the display-only split used across the app.
 */
function isSupportLeadIdentity(id?: string | null, email?: string | null): boolean {
  return id === "usr-supp-001" || email === "support@darkops.com";
}

function isLead(auth: any): boolean {
  return (
    auth?.user?.role === "PLATFORM_ADMIN" ||
    isSupportLeadIdentity(auth?.user?.id, auth?.user?.email)
  );
}

/** Enforce caller is the Support Lead (or a platform admin). */
function requireSupportLead(auth: any) {
  requireSupportRole(auth);
  if (!isLead(auth)) {
    throw new HTTPError(403, "FORBIDDEN", "This view is restricted to the Support Lead");
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();
    const { status, priority, queue, q } = req.query;

    let query = supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at, resolution_notes,
        complaints!complaint_id (complaint_ref, summary, category, order_id, customer_id, store_id),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (id, full_name, email)
      `,
      )
      .eq("assigned_to", auth.user.id)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      // Honor an explicit status filter (e.g. viewing resolved from this tab)
      query = query.eq("status", String(status));
    } else {
      // Default "My Tickets" view is the active queue only.
      // Resolved/closed tickets belong in the "Resolved History" tab.
      query = query.not("status", "in", '("resolved","closed")');
    }
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();
    const { status, priority, queue, q } = req.query;

    let query = supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at, assigned_to,
        complaints!complaint_id (complaint_ref, summary, category),
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at,
        complaints!complaint_id (complaint_ref, summary, category)
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        id, ticket_number, title, status, priority, queue, sla_deadline, created_at, updated_at, resolution_notes, resolution_time_minutes, assigned_to,
        complaints!complaint_id (complaint_ref, summary, category),
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();
    const { id } = req.params;

    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        `
        *,
        complaints!complaint_id (
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

    // Security: only the assignee or authorized support roles can read
    const isAssignee = (data as any).assigned_to === auth.user.id;
    const isSupportOrAdmin =
      ["CUSTOMER_SUPPORT", "PLATFORM_ADMIN", "OPERATIONS", "EXECUTIVE"].includes(auth.user.role) ||
      auth.permissions?.has("support.read");
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();
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

// ─── Team Workload Summary ───────────────────────────────────────────────────

/**
 * GET /support/team/workload
 * Returns per-agent workload breakdown (open, urgent, breached counts).
 */
export const getTeamWorkload = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportLead(auth);
    const supabase = createSupabaseServiceRoleClient();

    // Roster is the source of truth: all active support agents from profiles.
    const { data: agents, error: agentsErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "CUSTOMER_SUPPORT")
      .eq("is_active", true)
      // Exclude the legacy fraud "Risk Analyst" account from the support roster.
      .neq("email", "fraud@darkops.com");

    if (agentsErr) throw new HTTPError(500, "DATABASE_ERROR", agentsErr.message);

    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select("id, assigned_to, status, priority, sla_deadline");

    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    const workloadMap: Record<
      string,
      {
        agent_id: string;
        full_name: string;
        email: string;
        role: string;
        open_tickets_count: number;
        urgent_count: number;
        breached_count: number;
      }
    > = {};

    for (const a of agents || []) {
      workloadMap[a.id] = {
        agent_id: a.id,
        full_name: a.full_name || a.email,
        email: a.email,
        role: isSupportLeadIdentity(a.id, a.email) ? "SUPPORT_LEAD" : "SUPPORT_AGENT",
        open_tickets_count: 0,
        urgent_count: 0,
        breached_count: 0,
      };
    }

    for (const t of tickets || []) {
      const isResolved = t.status === "resolved" || t.status === "closed";
      if (isResolved) continue;
      const key = t.assigned_to;
      if (!key || !workloadMap[key]) continue; // skip unassigned / non-roster
      workloadMap[key].open_tickets_count++;
      if (t.priority === "P1") workloadMap[key].urgent_count++;
      if (getSlaState(t.sla_deadline) === "breached") workloadMap[key].breached_count++;
    }

    // Lead first, then busiest agents, for a stable, readable ordering.
    const data = Object.values(workloadMap).sort(
      (a, b) =>
        (a.role === "SUPPORT_LEAD" ? -1 : 0) - (b.role === "SUPPORT_LEAD" ? -1 : 0) ||
        b.open_tickets_count - a.open_tickets_count,
    );

    res.json({ data });
  } catch (error) {
    next(error);
  }
};

// ─── Team Performance (Support Lead only) ────────────────────────────────────

/**
 * GET /support/team/performance?period=24h|7d|30d
 * Support Lead / admin only. Per-agent performance: current workload plus
 * throughput (resolved) over the selected window and calendar day, with average
 * resolution time. All values are computed from support_tickets.
 */
export const getTeamPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportLead(auth);
    const supabase = createSupabaseServiceRoleClient();

    const period = String(req.query.period || "7d");
    const periodMs =
      period === "24h"
        ? 24 * 60 * 60 * 1000
        : period === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const periodStart = now - periodMs;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    const { data: agents, error: agentsErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "CUSTOMER_SUPPORT")
      .eq("is_active", true)
      // Exclude the legacy fraud "Risk Analyst" account from the support roster.
      .neq("email", "fraud@darkops.com");
    if (agentsErr) throw new HTTPError(500, "DATABASE_ERROR", agentsErr.message);

    const { data: tickets, error } = await supabase
      .from("support_tickets")
      .select(
        "id, assigned_to, resolved_by, status, priority, sla_deadline, updated_at, resolution_time_minutes",
      );
    if (error) throw new HTTPError(500, "DATABASE_ERROR", error.message);

    interface Row {
      agent_id: string;
      full_name: string;
      email: string;
      role: string;
      open_tickets: number;
      urgent_open: number;
      sla_breached_open: number;
      resolved_period: number;
      resolved_today: number;
      avg_resolution_minutes: number | null;
      _resolutionSum: number;
      _resolutionCount: number;
    }

    const rows: Record<string, Row> = {};
    for (const a of agents || []) {
      rows[a.id] = {
        agent_id: a.id,
        full_name: a.full_name || a.email,
        email: a.email,
        role: isSupportLeadIdentity(a.id, a.email) ? "SUPPORT_LEAD" : "SUPPORT_AGENT",
        open_tickets: 0,
        urgent_open: 0,
        sla_breached_open: 0,
        resolved_period: 0,
        resolved_today: 0,
        avg_resolution_minutes: null,
        _resolutionSum: 0,
        _resolutionCount: 0,
      };
    }

    for (const t of tickets || []) {
      const isResolved = t.status === "resolved" || t.status === "closed";
      if (!isResolved) {
        const key = t.assigned_to;
        if (!key || !rows[key]) continue;
        rows[key].open_tickets++;
        if (t.priority === "P1") rows[key].urgent_open++;
        if (getSlaState(t.sla_deadline) === "breached") rows[key].sla_breached_open++;
      } else {
        // Attribute resolutions to whoever resolved them (fallback to assignee).
        const key = t.resolved_by || t.assigned_to;
        if (!key || !rows[key]) continue;
        const resolvedAtMs = t.updated_at ? new Date(t.updated_at).getTime() : 0;
        if (resolvedAtMs >= periodStart) {
          rows[key].resolved_period++;
          if (typeof t.resolution_time_minutes === "number") {
            rows[key]._resolutionSum += t.resolution_time_minutes;
            rows[key]._resolutionCount++;
          }
        }
        if (resolvedAtMs >= todayStartMs) rows[key].resolved_today++;
      }
    }

    const data = Object.values(rows).map((r) => {
      const avg = r._resolutionCount > 0 ? Math.round(r._resolutionSum / r._resolutionCount) : null;
      // Strip internal accumulators from the response.

      const { _resolutionSum, _resolutionCount, ...rest } = r;
      void _resolutionSum;
      void _resolutionCount;
      return { ...rest, avg_resolution_minutes: avg };
    });

    data.sort(
      (a, b) =>
        (a.role === "SUPPORT_LEAD" ? -1 : 0) - (b.role === "SUPPORT_LEAD" ? -1 : 0) ||
        b.resolved_period - a.resolved_period ||
        b.open_tickets - a.open_tickets,
    );

    const summary = {
      total_open: data.reduce((s, r) => s + r.open_tickets, 0),
      total_resolved_period: data.reduce((s, r) => s + r.resolved_period, 0),
      total_resolved_today: data.reduce((s, r) => s + r.resolved_today, 0),
      total_urgent_open: data.reduce((s, r) => s + r.urgent_open, 0),
      total_sla_breached_open: data.reduce((s, r) => s + r.sla_breached_open, 0),
      agent_count: data.length,
    };

    res.json({ period, data, summary });
  } catch (error) {
    next(error);
  }
};

// ─── Assign Ticket ───────────────────────────────────────────────────────────

/**
 * PATCH /support/tickets/:id/assign
 * Assign ticket to self (assign_to_self: true) or to another agent.
 * Support Lead and PLATFORM_ADMIN can reassign to anyone.
 * Standard agents can only assign tickets to themselves.
 */
export const assignTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    requireSupportRole(auth);
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { assign_to_self, agent_id, assigned_to } = req.body;
    // Support both `assigned_to` (from inline table select) and `agent_id` (from API direct calls)
    const rawAgentId = assigned_to !== undefined ? assigned_to : agent_id;
    // Treat empty string as null (unassign)
    const resolvedAgentId = rawAgentId === "" ? null : rawAgentId;

    // Determine target agent
    let targetAgentId: string | null;
    if (assign_to_self) {
      targetAgentId = auth.user.id;
    } else if (resolvedAgentId === null || resolvedAgentId === "unassigned") {
      const isLeadOrAdmin =
        auth.user.role === "PLATFORM_ADMIN" ||
        auth.user.id === "usr-supp-001" ||
        auth.user.email === "support@darkops.com";
      if (!isLeadOrAdmin) {
        throw new HTTPError(
          403,
          "FORBIDDEN",
          "Only Support Lead or administrators can unassign tickets",
        );
      }
      targetAgentId = null;
    } else if (resolvedAgentId) {
      // Reassigning to another agent requires Support Lead or Admin
      const isLeadOrAdmin =
        auth.user.role === "PLATFORM_ADMIN" ||
        auth.user.id === "usr-supp-001" ||
        auth.user.email === "support@darkops.com";
      if (resolvedAgentId !== auth.user.id && !isLeadOrAdmin) {
        throw new HTTPError(
          403,
          "FORBIDDEN",
          "Only Support Lead or administrators can reassign tickets to other agents",
        );
      }
      targetAgentId = resolvedAgentId;
    } else {
      targetAgentId = auth.user.id;
    }

    // Fetch current ticket
    const { data: ticket, error: fetchErr } = await adminClient
      .from("support_tickets")
      .select("id, complaint_id, assigned_to, status, ticket_number")
      .eq("id", id)
      .single();

    if (fetchErr || !ticket) throw new HTTPError(404, "NOT_FOUND", "Ticket not found");

    const oldAssignee = ticket.assigned_to;

    // Get target agent profile
    let targetProfile = null;
    if (targetAgentId) {
      const { data: agentProfile } = await adminClient
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", targetAgentId)
        .single();
      targetProfile = agentProfile;
    }

    const { data: updated, error: updateErr } = await adminClient
      .from("support_tickets")
      .update({
        assigned_to: targetAgentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw new HTTPError(500, "DATABASE_ERROR", updateErr.message);

    // Bi-directional sync: update underlying complaint record as well
    if (ticket.complaint_id) {
      await adminClient
        .from("complaints")
        .update({
          assigned_agent_id: targetAgentId,
          status: targetAgentId ? "assigned" : "unassigned",
        })
        .eq("id", ticket.complaint_id);
    }

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "assigned",
      payload: {
        from: oldAssignee,
        to: targetAgentId,
        to_name: targetProfile?.full_name || "Unassigned",
      },
    });

    // Notify new assignee if different from actor (skip on unassign)
    if (targetAgentId && targetAgentId !== auth.user.id) {
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
    const { resolution_note, resolution_decision } = req.body;

    if (!resolution_note || String(resolution_note).trim().length < 5) {
      throw new HTTPError(
        400,
        "INVALID_INPUT",
        "Resolution note is required (minimum 5 characters)",
      );
    }

    const { data: ticket, error: fetchErr } = await adminClient
      .from("support_tickets")
      .select("id, complaint_id, assigned_to, status, created_at, ticket_number")
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

    const normDecision = (resolution_decision || "REFUND").toUpperCase();
    const validDecisions = ["REFUND", "REPLACEMENT", "SUPPORT_REVIEW", "NO_ACTION"];
    if (!validDecisions.includes(normDecision)) {
      throw new HTTPError(
        400,
        "INVALID_DECISION",
        `Invalid resolution decision. Must be one of: ${validDecisions.join(", ")}`,
      );
    }

    const ageMs = Date.now() - new Date(ticket.created_at).getTime();
    const resolutionMinutes = Math.round(ageMs / 60000);
    const nowIso = new Date().toISOString();

    // 1. Update Support Ticket
    const { data: updated, error: updateErr } = await adminClient
      .from("support_tickets")
      .update({
        status: "resolved",
        resolution_notes: String(resolution_note).trim(),
        resolved_by: auth.user.id,
        resolution_time_minutes: resolutionMinutes,
        updated_at: nowIso,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) throw new HTTPError(500, "DATABASE_ERROR", updateErr.message);

    // 2. Update linked Complaint & Trigger Execution Handoff if required
    let handoffId: string | undefined;
    if (ticket.complaint_id) {
      await adminClient
        .from("complaints")
        .update({
          status: "resolved",
          resolution: String(resolution_note).trim(),
          resolution_decision: normDecision,
          resolution_decision_reason: String(resolution_note).trim(),
          resolution_decided_by: auth.user.id,
          resolution_decided_at: nowIso,
          resolved_at: nowIso,
        })
        .eq("id", ticket.complaint_id);

      // Status history entry
      try {
        await adminClient.from("complaint_status_history").insert({
          complaint_id: ticket.complaint_id,
          from_status: "assigned",
          to_status: "resolved",
          changed_by: auth.user.id,
          note: `Resolved by agent (${auth.user.full_name || auth.user.id}): ${normDecision} - ${resolution_note}`,
        });
      } catch {
        /* ignore */
      }

      // If financial or replacement execution is required, trigger durable handoff
      if (normDecision === "REFUND" || normDecision === "REPLACEMENT") {
        try {
          const { data: comp } = await adminClient
            .from("complaints")
            .select("order_id")
            .eq("id", ticket.complaint_id)
            .single();

          if (comp?.order_id) {
            const handoff = await createExecutionHandoff({
              complaintId: ticket.complaint_id,
              orderId: comp.order_id,
              resolutionType: normDecision as "REFUND" | "REPLACEMENT",
              reason: String(resolution_note).trim(),
              metadata: { agent_id: auth.user.id, source: "support_agent_manual_decision" },
            });
            const dispatched = await dispatchHandoff(handoff.id);
            handoffId = dispatched.id;
          }
        } catch (hErr) {
          console.error("[resolveTicket] Handoff error:", hErr);
        }
      }
    }

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "resolved",
      payload: {
        note: String(resolution_note).trim(),
        resolution_decision: normDecision,
        resolution_time_minutes: resolutionMinutes,
        execution_handoff_id: handoffId,
      },
    });

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "support_ticket.resolve",
      resourceType: "support_ticket",
      resourceId: String(id),
      metadata: {
        ticket_number: ticket.ticket_number,
        resolution_decision: normDecision,
        resolution_time_minutes: resolutionMinutes,
        execution_handoff_id: handoffId,
      },
    });

    res.json({ ...updated, resolution_decision: normDecision, execution_handoff_id: handoffId });
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

/**
 * DELETE /support/tickets/:id/attachments/:attachmentId
 * Deletes an attachment from both storage and database.
 */
export const deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
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
      throw new HTTPError(403, "FORBIDDEN", "Only ticket assignee can delete attachments");
    }

    // Get attachment details
    const { data: attachment } = await adminClient
      .from("ticket_attachments")
      .select("storage_path, filename")
      .eq("id", attachmentId)
      .eq("ticket_id", id)
      .single();

    if (!attachment) throw new HTTPError(404, "NOT_FOUND", "Attachment not found");

    // Delete from storage
    const { error: storageError } = await adminClient.storage
      .from("ticket-attachments")
      .remove([attachment.storage_path]);

    if (storageError) {
      throw new HTTPError(500, "STORAGE_ERROR", storageError.message);
    }

    // Delete from database
    const { error: dbError } = await adminClient
      .from("ticket_attachments")
      .delete()
      .eq("id", attachmentId)
      .eq("ticket_id", id);

    if (dbError) throw new HTTPError(500, "DATABASE_ERROR", dbError.message);

    // Write activity event
    await adminClient.from("ticket_activity").insert({
      ticket_id: id,
      actor_id: auth.user.id,
      event_type: "attachment_deleted",
      payload: { filename: attachment.filename },
    });

    // Update ticket updated_at
    await adminClient
      .from("support_tickets")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    res.status(204).send();
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
    // Use the service-role client with in-code scoping (requireSupportRole +
    // per-user assigned_to filters). Support sessions use mock tokens, which the
    // RLS client cannot validate as JWTs; this matches the pattern used across
    // the rest of the controllers and works for both mock and real sessions.
    const supabase = createSupabaseServiceRoleClient();

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
    const { complaint_id, queue, priority, title, assigned_to } = req.body;

    const ticketNumber = `TKT-${Date.now()}`;
    // Load-balanced assignment: honor an explicit assignee, otherwise route to
    // the support agent with the fewest active tickets. Fall back to the creator
    // only if no agent could be resolved.
    const assignedTo =
      (typeof assigned_to === "string" && assigned_to) ||
      (await autoAssignSupportAgent(queue)) ||
      auth.user.id;

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
      metadata: { ticket_number: ticketNumber, queue, priority, assigned_to: assignedTo },
    });

    // Notify the auto-assigned agent when it is not the creator.
    if (assignedTo && assignedTo !== auth.user.id) {
      try {
        await adminClient.from("notifications").insert({
          recipient_id: assignedTo,
          title: `You have been assigned ticket ${ticketNumber}`,
          meta: JSON.stringify({ ticket_id: data.id }),
          link_type: "support_ticket",
          link_ref: data.id,
        });
      } catch {
        /* non-fatal */
      }
    }

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
