import { Request, Response, NextFunction } from 'express';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '../lib/supabase';
import { assignCase, escalateCase, resolveCase } from '../services/case.service';
import { HTTPError } from '../middleware/errors';

export const getOperationsMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use service role to bypass RLS for demo purposes
    const adminClient = createSupabaseServiceRoleClient();
    const userRole = (req as any).auth?.user.role;
    const userId = (req as any).auth?.user.id;

    console.log('[getOperationsMetrics] User role:', userRole);

    // Build base query with role-based filtering
    let complaintsQuery = adminClient.from('complaints').select('*');
    
    // For demo purposes, show all complaints
    const { data: complaints, error } = await complaintsQuery;
    
    console.log('[getOperationsMetrics] Complaints count:', complaints?.length);
    console.log('[getOperationsMetrics] Error:', error);

    // Calculate metrics
    const queueSize = complaints?.filter(c => c.status !== 'resolved').length || 0;
    const slaAtRisk = complaints?.filter(c => c.sla_state === 'at_risk').length || 0;
    const slaBreached = complaints?.filter(c => c.sla_state === 'breached').length || 0;
    const p1Cases = complaints?.filter(c => c.priority === 'P1' && c.status !== 'resolved').length || 0;
    const escalated = complaints?.filter(c => c.status === 'escalated_l2').length || 0;
    
    console.log('[getOperationsMetrics] Metrics:', { queueSize, slaAtRisk, slaBreached, p1Cases, escalated });
    
    // Get agent workload (for managers)
    let agentWorkload: any[] = [];
    if (userRole === 'OPERATIONS' || userRole === 'PLATFORM_ADMIN') {
      const { data: agents } = await adminClient
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'OPERATIONS');
      
      agentWorkload = await Promise.all(
        (agents || []).map(async (agent) => {
          const { count } = await adminClient
            .from('complaints')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_agent_id', agent.id)
            .in('status', ['assigned', 'in_progress']);
          return {
            agent_id: agent.id,
            agent_name: agent.full_name,
            workload: count || 0,
          };
        })
      );
    }

    // Get category breakdown
    const categoryBreakdown = complaints?.reduce((acc: any, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      queue_size: queueSize,
      sla_at_risk: slaAtRisk,
      sla_breached: slaBreached,
      p1_cases: p1Cases,
      escalated,
      agent_workload: agentWorkload,
      category_breakdown: categoryBreakdown,
    });
  } catch (error) {
    console.error('[getOperationsMetrics] Error:', error);
    next(error);
  }
};

export const getCases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use service role to bypass RLS for demo purposes
    const adminClient = createSupabaseServiceRoleClient();
    const query: any = req.query; // Already validated by Zod

    console.log('[getCases] Query params:', query);

    let dbQuery = adminClient
      .from('complaints')
      .select('*, customers!inner(full_name), stores!inner(name, city)', { count: 'exact' });

    // Apply filters
    if (query.status) dbQuery = dbQuery.eq('status', query.status);
    if (query.priority) dbQuery = dbQuery.eq('priority', query.priority);
    if (query.category) dbQuery = dbQuery.eq('category', query.category);
    
    // For demo purposes, show all cases without role filtering
    const limit = parseInt(query.limit) || 100;
    const page = parseInt(query.page) || 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    
    console.log('[getCases] Pagination:', { page, limit, from, to });
    
    dbQuery = dbQuery.range(from, to).order('created_at', { ascending: false });

    const { data, error, count } = await dbQuery;

    console.log('[getCases] Cases count:', data?.length);
    console.log('[getCases] Error:', error);
    console.log('[getCases] Total count:', count);

    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Database error: ${error.message}`);
    }

    res.status(200).json({
      data,
      meta: { total: count, page, limit }
    });
  } catch (error) {
    console.error('[getCases] Error:', error);
    next(error);
  }
};

export const getCaseById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServiceRoleClient();
    const { id } = req.params;

    // Fetch case with related data including assigned agent name and fraud review
    const { data, error } = await supabase
      .from('complaints')
      .select(`
        *,
        customers(full_name, id),
        stores(name, city, id),
        assigned_agent:profiles!assigned_agent_id(id, full_name),
        complaint_status_history(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new HTTPError(404, 'NOT_FOUND', 'Case not found or access denied.');
    }

    // Check for associated fraud review
    const { data: fraudReview } = await supabase
      .from('fraud_reviews')
      .select('id, confidence_score, decision')
      .eq('complaint_id', id)
      .maybeSingle();

    res.status(200).json({
      data: {
        ...data,
        agent_name: (data as any).assigned_agent?.full_name || null,
        fraud_review: fraudReview ? {
          id: fraudReview.id,
          confidence: fraudReview.confidence_score,
          decision: fraudReview.decision,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const assignCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;
    await assignCase(id as string, agent_id, (req as any).auth!);
    res.status(200).json({ success: true, message: 'Case assigned successfully' });
  } catch (error) {
    next(error);
  }
};

export const escalateCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    await escalateCase(id as string, note, (req as any).auth!);
    res.status(200).json({ success: true, message: 'Case escalated successfully' });
  } catch (error) {
    next(error);
  }
};

export const resolveCaseHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { resolution, note } = req.body;
    await resolveCase(id as string, resolution, note, (req as any).auth!);
    res.status(200).json({ success: true, message: 'Case resolved successfully' });
  } catch (error) {
    next(error);
  }
};

/** Returns all active agents for the assignment dropdown. */
export const getAgents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, store_id')
      .eq('role', 'OPERATIONS')
      .eq('is_active', true)
      .order('full_name');

    if (error) throw error;

    // Get workload counts for each agent
    const agentsWithLoad = await Promise.all(
      (data || []).map(async (agent) => {
        const { count } = await supabase
          .from('complaints')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_agent_id', agent.id)
          .in('status', ['assigned', 'in_progress']);
        return {
          id: agent.id,
          name: agent.full_name,
          hub: 'Ops Hub',
          load: count || 0,
          capacity: 20,
        };
      })
    );

    res.status(200).json({ data: agentsWithLoad });
  } catch (error) {
    next(error);
  }
};
