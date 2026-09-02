import { Request, Response, NextFunction } from 'express';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '../lib/supabase';
import { HTTPError } from '../middleware/errors';

export const getStores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Use service role to bypass RLS for demo purposes
    const adminClient = createSupabaseServiceRoleClient();
    const query: any = req.query;

    let dbQuery = adminClient
      .from('stores')
      .select(`
        *,
        store_metrics_snapshots (
          sla_pct, refund_rate_pct, open_issues, avg_resolution_mins
        ),
        pulse_scores (
          score, equipment_pts, sla_pts, refunds_pts, delivery_pts, picker_pts, inventory_pts
        )
      `, { count: 'exact' });

    if (query.city) dbQuery = dbQuery.eq('city', query.city);
    if (query.zone) dbQuery = dbQuery.eq('zone', query.zone);

    const limit = parseInt(query.limit) || 200;
    const page = parseInt(query.page) || 1;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to).order('name', { ascending: true });

    const { data, error, count } = await dbQuery;
    if (error) throw new HTTPError(500, 'DATABASE_ERROR', `Database error: ${error.message}`);

    const formattedData = data.map(store => ({
      ...store,
      metrics: store.store_metrics_snapshots?.[0] || null,
      pulse_scores: store.pulse_scores?.[0] || null,
      pulse: store.pulse_scores?.[0]?.score || null,
      store_metrics_snapshots: undefined,
    }));

    res.status(200).json({
      data: formattedData,
      meta: { total: count, page, limit }
    });
  } catch (error) {
    next(error);
  }
};

export const getStoreById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    console.log('[getStoreById] Fetching store:', id);
    
    // Use service role to bypass RLS since we already check permissions via RBAC middleware
    const adminClient = createSupabaseServiceRoleClient();
    console.log('[getStoreById] Service role client created');
    
    const { data, error } = await adminClient
      .from('stores')
      .select(`
        *,
        store_metrics_snapshots (*),
        pulse_scores (*)
      `)
      .eq('id', id)
      .single();

    console.log('[getStoreById] Query result:', { error: error?.message, hasData: !!data });

    if (error || !data) {
      console.error('[getStoreById] Error:', error);
      throw new HTTPError(404, 'NOT_FOUND', `Store not found: ${error?.message || 'Unknown error'}`);
    }

    const formattedData = {
      ...data,
      metrics: data.store_metrics_snapshots?.[0] || null,
      pulse: data.pulse_scores?.[0] || null,
      store_metrics_snapshots: undefined,
      pulse_scores: undefined
    };

    console.log('[getStoreById] Returning formatted data for store:', id);
    res.status(200).json(formattedData);
  } catch (error) {
    console.error('[getStoreById] Unexpected error:', error);
    next(error);
  }
};

export const getStorePulse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const supabase = createSupabaseServerClient(req, res);
    
    const { data, error } = await supabase
      .from('pulse_scores')
      .select('*')
      .eq('store_id', id)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      throw new HTTPError(404, 'NOT_FOUND', 'Pulse score not found.');
    }

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getStoreWorkOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const supabase = createSupabaseServerClient(req, res);
    
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('store_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Database error: ${error.message}`);
    }

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const createStoreWorkOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { asset_id, asset_name, priority, description } = req.body;
    const auth = (req as any).auth;
    
    const supabase = createSupabaseServerClient(req, res);
    
    const { data, error } = await supabase
      .from('work_orders')
      .insert({
        id: `WO-${Date.now()}`,
        store_id: id,
        asset_id,
        asset_name,
        priority,
        status: 'open',
        description,
        assigned_to: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Failed to create work order: ${error.message}`);
    }

    await supabase.from('audit_logs').insert({
      actor_id: auth.user.id,
      actor_role: auth.user.role,
      action: 'work_order.create',
      resource_type: 'work_order',
      resource_id: data.id,
      metadata: { store_id: id, asset_id, priority },
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};
