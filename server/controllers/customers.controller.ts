import { Request, Response, NextFunction } from 'express';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '../lib/supabase';
import { logAudit } from '../services/audit.service';
import { HTTPError } from '../middleware/errors';

export const getCustomerOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;
    
    // Try to find customer by profile_id first, then by email as fallback
    let customer;
    const { data: customerByProfile, error: profileErr } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', auth.user.id)
      .single();
    
    if (!profileErr && customerByProfile) {
      customer = customerByProfile;
    } else {
      // Fallback: try to find by email
      const { data: customerByEmail, error: emailErr } = await supabase
        .from('customers')
        .select('id')
        .eq('email', auth.user.email)
        .single();
      
      if (emailErr || !customerByEmail) {
        throw new HTTPError(404, 'NOT_FOUND', 'Customer profile not found');
      }
      customer = customerByEmail;
    }

    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*, stores(name)')
      .eq('customer_id', customer.id)
      .order('placed_at', { ascending: false });

    if (ordersErr) throw new HTTPError(500, 'DATABASE_ERROR', 'Failed to fetch orders');

    res.status(200).json({ data: orders });
  } catch (error) {
    next(error);
  }
};

export const getCustomerComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const auth = (req as any).auth;
    
    // Try to find customer by profile_id first, then by email as fallback
    let customer;
    const { data: customerByProfile, error: profileErr } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', auth.user.id)
      .single();
    
    if (!profileErr && customerByProfile) {
      customer = customerByProfile;
    } else {
      // Fallback: try to find by email
      const { data: customerByEmail, error: emailErr } = await supabase
        .from('customers')
        .select('id')
        .eq('email', auth.user.email)
        .single();
      
      if (emailErr || !customerByEmail) {
        throw new HTTPError(404, 'NOT_FOUND', 'Customer profile not found');
      }
      customer = customerByEmail;
    }

    const { data: complaints, error } = await supabase
      .from('complaints')
      .select('*, orders(item_count)')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) throw new HTTPError(500, 'DATABASE_ERROR', 'Failed to fetch complaints');

    res.status(200).json({ data: complaints });
  } catch (error) {
    next(error);
  }
};

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const { order_id, category, details } = req.body;
    
    console.log('[createComplaint] Request:', { order_id, category, details, userId: auth.user.id, userEmail: auth.user.email });
    
    // Try to find customer by profile_id first, then by email as fallback
    let customer;
    const { data: customerByProfile, error: profileErr } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', auth.user.id)
      .single();
    
    console.log('[createComplaint] Customer by profile:', { profileErr, customerByProfile });
    
    if (!profileErr && customerByProfile) {
      customer = customerByProfile;
    } else {
      // Fallback: try to find by email
      const { data: customerByEmail, error: emailErr } = await supabase
        .from('customers')
        .select('id')
        .eq('email', auth.user.email)
        .single();
      
      console.log('[createComplaint] Customer by email:', { emailErr, customerByEmail });
      
      if (emailErr || !customerByEmail) {
        console.error('[createComplaint] Customer not found');
        throw new HTTPError(404, 'NOT_FOUND', 'Customer profile not found');
      }
      customer = customerByEmail;
    }

    console.log('[createComplaint] Found customer:', customer.id);

    const { data: order } = await supabase.from('orders').select('store_id, total_amount_paise').eq('id', order_id).eq('customer_id', customer.id).single();
    if (!order) {
      console.error('[createComplaint] Order not found:', order_id);
      throw new HTTPError(400, 'INVALID_ORDER', 'Order not found or does not belong to you');
    }

    console.log('[createComplaint] Order found:', order);

    const complaintId = `CS-${Math.floor(Math.random() * 10000) + 5000}`;
    const complaintRef = `CMP-${Math.floor(Math.random() * 100000) + 500000}`;

    const newComplaint = {
      id: complaintId,
      complaint_ref: complaintRef,
      customer_id: customer.id,
      order_id: order_id,
      store_id: order.store_id,
      summary: `Customer reported: ${category}`,
      detail: details,
      category,
      type: 'operational_investigation',
      priority: 'P3',
      status: 'unassigned',
      order_value_paise: order.total_amount_paise,
    };

    console.log('[createComplaint] Inserting complaint:', newComplaint);

    const { error: insertErr } = await adminClient.from('complaints').insert(newComplaint);
    if (insertErr) {
      console.error('[createComplaint] Insert error:', insertErr);
      throw new HTTPError(500, 'CREATE_FAILED', 'Failed to submit complaint');
    }

    console.log('[createComplaint] Complaint created successfully');

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: 'complaint.create',
      resourceType: 'complaint',
      resourceId: complaintId,
    });

    res.status(201).json({ data: newComplaint });
  } catch (error) {
    next(error);
  }
};
