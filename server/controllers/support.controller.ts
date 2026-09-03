import { Request, Response, NextFunction } from 'express';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '../lib/supabase';
import { logAudit } from '../services/audit.service';
import { HTTPError } from '../middleware/errors';

export const getSupportTickets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;
    const { queue, status, priority } = req.query;
    
    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        complaints (complaint_ref, summary, category, type, urgency_score, sentiment),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (full_name, email),
        created_by_profile:profiles!support_tickets_created_by_fkey (full_name, email)
      `);
    
    // Filter by queue if specified
    if (queue) query = query.eq('queue', queue);
    
    // Filter by status if specified
    if (status) query = query.eq('status', status);
    
    // Filter by priority if specified
    if (priority) query = query.eq('priority', priority);
    
    // Customer support can see all tickets, others only see their own
    if (auth.user.role !== 'CUSTOMER_SUPPORT' && auth.user.role !== 'PLATFORM_ADMIN') {
      query = query.eq('assigned_to', auth.user.id);
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Database error: ${error.message}`);
    }
    
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const getSupportTicketById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('support_tickets')
      .select(`
        *,
        complaints (*),
        assigned_to_profile:profiles!support_tickets_assigned_to_fkey (full_name, email),
        created_by_profile:profiles!support_tickets_created_by_fkey (full_name, email),
        resolved_by_profile:profiles!support_tickets_resolved_by_fkey (full_name, email)
      `)
      .eq('id', id)
      .single();
    
    if (error || !data) {
      throw new HTTPError(404, 'NOT_FOUND', 'Support ticket not found or access denied');
    }
    
    // Check access permissions
    if (auth.user.role !== 'CUSTOMER_SUPPORT' && auth.user.role !== 'PLATFORM_ADMIN') {
      if (data.assigned_to !== auth.user.id) {
        throw new HTTPError(403, 'FORBIDDEN', 'Access denied');
      }
    }
    
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getFailedAutomationQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    
    const { data, error } = await supabase
      .from('failed_automation')
      .select(`
        *,
        complaints (complaint_ref, summary, category, type, store_id)
      `)
      .is('resolved_at', null)
      .order('urgency_score', { ascending: false })
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Database error: ${error.message}`);
    }
    
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const createSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    const adminClient = createSupabaseServiceRoleClient();
    const { complaint_id, queue, priority } = req.body;
    
    // Generate ticket number
    const ticketNumber = `TKT-${Date.now()}`;
    
    // Auto-assign to available agent
    const assignedTo = await autoAssignSupportAgent(queue || 'general', adminClient);
    
    // Calculate SLA deadline
    const slaMinutes = {
      'P1': 15,
      'P2': 30,
      'P3': 120,
      'P4': 480
    };
    const slaDeadline = new Date();
    slaDeadline.setMinutes(slaDeadline.getMinutes() + (slaMinutes[priority as keyof typeof slaMinutes] || 120));
    
    const { data, error } = await adminClient
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        complaint_id,
        assigned_to: assignedTo,
        status: 'open',
        priority: priority || 'P3',
        queue: queue || 'general',
        sla_deadline: slaDeadline.toISOString(),
        created_by: auth.user.id
      })
      .select()
      .single();
    
    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Failed to create support ticket: ${error.message}`);
    }
    
    // Log ticket creation
    await adminClient.from('support_ticket_history').insert({
      ticket_id: data.id,
      actor_id: auth.user.id,
      actor_role: auth.user.role,
      action: 'ticket_created',
      new_status: 'open',
      new_assigned_to: assignedTo
    });
    
    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: 'support_ticket.create',
      resourceType: 'support_ticket',
      resourceId: data.id,
      metadata: { ticket_number: ticketNumber, queue, priority }
    });
    
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

export const updateSupportTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { status, assigned_to, priority, notes } = req.body;
    
    // Get current ticket
    const { data: currentTicket, error: fetchError } = await adminClient
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .single();
    
    if (fetchError || !currentTicket) {
      throw new HTTPError(404, 'NOT_FOUND', 'Support ticket not found');
    }
    
    // Update ticket
    const updateData: any = {};
    if (status) updateData.status = status;
    if (assigned_to) updateData.assigned_to = assigned_to;
    if (priority) updateData.priority = priority;
    if (notes) updateData.resolution_notes = notes;
    updateData.updated_at = new Date().toISOString();
    
    // If resolving, set resolution time and resolver
    if (status === 'resolved' || status === 'closed') {
      const createdTime = new Date(currentTicket.created_at);
      const resolvedTime = new Date();
      const resolutionMinutes = Math.round((resolvedTime.getTime() - createdTime.getTime()) / 60000);
      updateData.resolution_time_minutes = resolutionMinutes;
      updateData.resolved_by = auth.user.id;
    }
    
    const { data: updatedTicket, error: updateError } = await adminClient
      .from('support_tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Failed to update support ticket: ${updateError.message}`);
    }
    
    // Log history
    await adminClient.from('support_ticket_history').insert({
      ticket_id: id,
      actor_id: auth.user.id,
      actor_role: auth.user.role,
      action: 'ticket_updated',
      old_status: currentTicket.status,
      new_status: status || currentTicket.status,
      old_assigned_to: currentTicket.assigned_to,
      new_assigned_to: assigned_to || currentTicket.assigned_to,
      notes: typeof notes === 'string' ? notes : undefined
    });
    
    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: 'support_ticket.update',
      resourceType: 'support_ticket',
      resourceId: typeof id === 'string' ? id : Array.isArray(id) ? id[0] : String(id),
      metadata: (() => {
        const meta: Record<string, any> = {};
        if (typeof status === 'string') meta.status = status;
        else if (Array.isArray(status) && status.length > 0) meta.status = status[0];
        if (typeof assigned_to === 'string') meta.assigned_to = assigned_to;
        else if (Array.isArray(assigned_to) && assigned_to.length > 0) meta.assigned_to = assigned_to[0];
        if (typeof priority === 'string') meta.priority = priority;
        else if (Array.isArray(priority) && priority.length > 0) meta.priority = priority[0];
        return meta;
      })()
    });
    
    res.status(200).json(updatedTicket);
  } catch (error) {
    next(error);
  }
};

export const getTicketHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('support_ticket_history')
      .select('*')
      .eq('ticket_id', id)
      .order('occurred_at', { ascending: false });
    
    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Database error: ${error.message}`);
    }
    
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const resolveFailedAutomation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const auth = (req as any).auth;
    const adminClient = createSupabaseServiceRoleClient();
    const { id } = req.params;
    const { notes, action_taken } = req.body;
    
    const { data, error } = await adminClient
      .from('failed_automation')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: auth.user.id,
        notes: typeof notes === 'string' ? notes : (typeof action_taken === 'string' ? action_taken : undefined)
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Failed to resolve failed automation: ${error.message}`);
    }
    
    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: 'failed_automation.resolve',
      resourceType: 'failed_automation',
      resourceId: typeof id === 'string' ? id : Array.isArray(id) ? id[0] : String(id),
      metadata: (() => {
        const meta: Record<string, any> = {};
        if (typeof notes === 'string') meta.notes = notes;
        if (typeof action_taken === 'string') meta.action_taken = action_taken;
        return meta;
      })()
    });
    
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

async function autoAssignSupportAgent(queue: string, adminClient: any): Promise<string | null> {
  try {
    const { data: agents } = await adminClient
      .from('profiles')
      .select('id')
      .eq('role', 'CUSTOMER_SUPPORT')
      .eq('is_active', true);
    
    if (!agents || agents.length === 0) {
      return null;
    }
    
    const agentWorkloads = await Promise.all(
      agents.map(async (agent: any) => {
        const { count } = await adminClient
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', agent.id)
          .in('status', ['open', 'in_progress']);
        
        return {
          agentId: agent.id,
          workload: count || 0
        };
      })
    );
    
    agentWorkloads.sort((a, b) => a.workload - b.workload);
    
    return agentWorkloads[0]?.agentId || null;
  } catch (error) {
    console.error('[Support] Error auto-assigning agent:', error);
    return null;
  }
}
