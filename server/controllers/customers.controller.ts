import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { logAudit, logSecurityEvent } from "../services/audit.service";
import { HTTPError } from "../middleware/errors";
import { processComplaint } from "../services/automation.service";
import { filterAllowedFields, sanitizeString } from "../lib/validation";
import { toOrderDTO, toComplaintDTO } from "../lib/dto";

/**
 * Shared helper: resolves a customer record for the authenticated user.
 * Tries profile_id first, then falls back to email.
 * On email match, auto-links profile_id so future lookups use the faster path.
 */
async function resolveCustomer(
  adminClient: ReturnType<typeof createSupabaseServiceRoleClient>,
  auth: { user: { id: string; email: string } },
) {
  // 1. Try profile_id
  const { data: byProfile, error: profileErr } = await adminClient
    .from("customers")
    .select("id, email")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (!profileErr && byProfile) {
    return byProfile;
  }

  // 2. Try email
  const { data: byEmail, error: emailErr } = await adminClient
    .from("customers")
    .select("id, email")
    .eq("email", auth.user.email)
    .maybeSingle();

  if (emailErr || !byEmail) {
    throw new HTTPError(404, "NOT_FOUND", "Customer profile not found. Please contact support.");
  }

  // 3. Auto-link: save profile_id so next request uses the fast path
  await adminClient.from("customers").update({ profile_id: auth.user.id }).eq("id", byEmail.id);

  return byEmail;
}

export const getCustomerOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const customer = await resolveCustomer(adminClient, auth);

    const { data: orders, error: ordersErr } = await adminClient
      .from("orders")
      .select("*, stores(name)")
      .eq("customer_id", customer.id)
      .order("placed_at", { ascending: false });

    if (ordersErr) throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch orders");

    // Apply data minimization via DTO
    const ordersDTO = orders.map(toOrderDTO);
    res.status(200).json({ data: ordersDTO });
  } catch (error) {
    next(error);
  }
};

export const getCustomerComplaints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const customer = await resolveCustomer(adminClient, auth);

    const { data: complaints, error } = await adminClient
      .from("complaints")
      .select("*, orders(item_count), stores(name)")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (error) throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch complaints");

    // Apply data minimization via DTO
    const complaintsDTO = complaints.map(toComplaintDTO);
    res.status(200).json({ data: complaintsDTO });
  } catch (error) {
    next(error);
  }
};

export const getCustomerOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const { id } = req.params;
    const requestId = (req as any).requestId || "unknown";

    // IDOR Protection: Verify customer ownership first
    const customer = await resolveCustomer(adminClient, auth);

    // Check if order exists and belongs to customer
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .select("id, customer_id")
      .eq("id", id)
      .single();

    if (orderErr || !order) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "IDOR_ATTEMPT",
        resourceType: "order",
        resourceId: id,
        requestId,
        ip: Array.isArray(req.ip) ? req.ip[0] : req.ip,
        metadata: { reason: "non-existent_resource" },
      });
      throw new HTTPError(404, "NOT_FOUND", "Order not found");
    }

    if (order.customer_id !== customer.id) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "IDOR_ATTEMPT",
        resourceType: "order",
        resourceId: id,
        requestId,
        ip: Array.isArray(req.ip) ? req.ip[0] : req.ip,
        metadata: {
          reason: "ownership_violation",
          customer_id: customer.id,
          target_customer_id: order.customer_id,
        },
      });
      throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access this order");
    }

    // Fetch full order details with ownership verified
    const { data: fullOrder, error: fullOrderErr } = await adminClient
      .from("orders")
      .select("*, stores(name, city, zone)")
      .eq("id", id)
      .single();

    if (fullOrderErr || !fullOrder) {
      throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch order details");
    }

    // Apply data minimization via DTO
    const orderDTO = toOrderDTO(fullOrder);
    res.status(200).json({ data: orderDTO });
  } catch (error) {
    next(error);
  }
};

export const getCustomerComplaintById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const { id } = req.params;
    const requestId = (req as any).requestId || "unknown";

    // IDOR Protection: Verify customer ownership first
    const customer = await resolveCustomer(adminClient, auth);

    // Check if complaint exists and belongs to customer
    const { data: complaint, error: complaintErr } = await adminClient
      .from("complaints")
      .select("id, customer_id")
      .eq("id", id)
      .single();

    if (complaintErr || !complaint) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "IDOR_ATTEMPT",
        resourceType: "complaint",
        resourceId: id,
        requestId,
        ip: Array.isArray(req.ip) ? req.ip[0] : req.ip,
        metadata: { reason: "non-existent_resource" },
      });
      throw new HTTPError(404, "NOT_FOUND", "Complaint not found");
    }

    if (complaint.customer_id !== customer.id) {
      await logSecurityEvent({
        actorId: auth.user.id,
        actorRole: auth.user.role,
        action: "IDOR_ATTEMPT",
        resourceType: "complaint",
        resourceId: id,
        requestId,
        ip: Array.isArray(req.ip) ? req.ip[0] : req.ip,
        metadata: {
          reason: "ownership_violation",
          customer_id: customer.id,
          target_customer_id: complaint.customer_id,
        },
      });
      throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access this complaint");
    }

    // Fetch full complaint details with ownership verified
    const { data: fullComplaint, error: fullComplaintErr } = await adminClient
      .from("complaints")
      .select(
        "*, orders(item_count, total_amount_paise), stores(name), complaint_attachments(id, filename, file_type, uploaded_at), complaint_status_history(from_status, to_status, changed_at, note)",
      )
      .eq("id", id)
      .single();

    if (fullComplaintErr || !fullComplaint) {
      throw new HTTPError(500, "DATABASE_ERROR", "Failed to fetch complaint details");
    }

    // Apply data minimization via DTO
    const complaintDTO = toComplaintDTO(fullComplaint);
    res.status(200).json({ data: complaintDTO });
  } catch (error) {
    next(error);
  }
};

export const createComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;

    // Mass assignment protection: only allow specific fields
    const allowedFields = ["order_id", "category", "details", "attachments"] as const;
    const filteredInput = filterAllowedFields<{
      order_id: string;
      category: string;
      details: string;
      attachments?: any[];
    }>(req.body, allowedFields);

    const { order_id, category, details, attachments } = filteredInput;

    // Input sanitization with validation
    if (!category || typeof category !== "string") {
      throw new HTTPError(400, "INVALID_INPUT", "Category is required");
    }
    if (!details || typeof details !== "string") {
      throw new HTTPError(400, "INVALID_INPUT", "Details are required");
    }

    const sanitizedDetails = sanitizeString(details);
    const sanitizedCategory = sanitizeString(category);

    const customer = await resolveCustomer(adminClient, auth);

    // Validate order ownership
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .select("id, store_id, total_amount_paise")
      .eq("id", order_id)
      .eq("customer_id", customer.id)
      .single();

    if (orderErr || !order) {
      throw new HTTPError(400, "INVALID_ORDER", "Order not found or does not belong to you");
    }

    // Generate complaint IDs
    const complaintId = `CMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const complaintRef = `REF-${Date.now()}`;

    // (Category → DB type mapping is done after summary)

    // Build a human-readable summary
    const categoryLabels: Record<string, string> = {
      wrong_item: "Wrong item received",
      missing_item: "Missing item",
      late_delivery: "Late delivery",
      damaged_item: "Damaged item",
      quality_issue: "Quality issue",
      reorder: "Reorder request",
      payment_issue: "Payment issue",
      other: "Customer inquiry",
    };
    const summary = categoryLabels[sanitizedCategory] || "Support request";

    // Map category to valid DB enum (complaint_category)
    const categoryDbMap: Record<string, string> = {
      wrong_item: "wrong_item",
      missing_item: "missing_item",
      late_delivery: "late_delivery",
      damaged_item: "damaged_item",
      quality_issue: "quality_issue",
      reorder: "other", // 'reorder' not in complaint_category enum
      payment_issue: "payment_issue",
      other: "other",
    };
    const dbCategory = categoryDbMap[sanitizedCategory] || "other";

    // Map category to complaint_type enum
    const complaintTypeMap: Record<string, string> = {
      wrong_item: "operational_investigation",
      missing_item: "operational_investigation",
      late_delivery: "operational_investigation",
      damaged_item: "refund",
      quality_issue: "refund",
      reorder: "reorder",
      payment_issue: "refund",
      other: "operational_investigation",
    };
    const dbComplaintType = complaintTypeMap[sanitizedCategory] || "operational_investigation";

    // Insert complaint
    const newComplaint = {
      id: complaintId,
      complaint_ref: complaintRef,
      customer_id: customer.id,
      order_id,
      store_id: order.store_id,
      category: dbCategory,
      summary,
      detail: sanitizedDetails,
      type: dbComplaintType,
      status: "unassigned",
      priority: "P3",
      order_value_paise: order.total_amount_paise || 0,
    };

    const { error: insertErr } = await adminClient.from("complaints").insert(newComplaint);
    if (insertErr) {
      throw new HTTPError(500, "INSERT_FAILED", `Failed to create complaint: ${insertErr.message}`);
    }

    // Insert initial status history entry
    await adminClient.from("complaint_status_history").insert({
      complaint_id: complaintId,
      from_status: null,
      to_status: "unassigned",
      changed_by: auth.user.id,
      note: "Complaint submitted by customer",
    }).catch((err: any) => console.error("[createComplaint] Status history error:", err));

    // Create customer notification (recipient_id = auth user profile id)
    await adminClient.from("notifications").insert({
      recipient_id: auth.user.id,
      title: `Complaint received: ${summary}`,
      meta: JSON.stringify({ complaint_id: complaintId, complaint_ref: complaintRef }),
      link_type: "complaint",
      link_ref: complaintId,
    }).catch((err: any) => console.error("[createComplaint] Notification error:", err));

    // Create support ticket (only columns that exist in the schema)
    const ticketId = `TKT-${Date.now()}`;
    const ticketQueue = dbComplaintType === "refund" ? "refunds" : dbComplaintType === "reorder" ? "reorders" : "general";
    await adminClient.from("support_tickets").insert({
      id: ticketId,
      complaint_id: complaintId,
      title: `${summary} – ${order_id}`,
      status: "open",
      priority: "P3",
      queue: ticketQueue,
    }).catch((err: any) => console.error("[createComplaint] Ticket insert error:", err));

    // Log ticket activity
    await adminClient.from("ticket_activity").insert({
      ticket_id: ticketId,
      event_type: "created",
      payload: { complaint_id: complaintId, order_id },
    });

    // Process attachments
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const attachmentRows = attachments.map((att: any) => ({
        complaint_id: complaintId,
        filename: att.filename,
        storage_path: att.storage_path,
        file_type: att.file_type,
        file_size_bytes: att.file_size_bytes,
        uploaded_by: auth.user.id,
      }));
      await adminClient.from("complaint_attachments").insert(attachmentRows);
    }

    processComplaint(complaintId).catch((err) => console.error(err));

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "COMPLAINT_CREATED",
      resourceType: "complaint",
      resourceId: complaintId,
      requestId: (req as any).requestId,
      metadata: { order_id, category },
    });

    res.status(201).json({
      data: {
        ...newComplaint,
        ticket_id: ticketId,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const requestHumanSupport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const { complaint_id } = req.body;
    const customer = await resolveCustomer(adminClient, auth);

    // Verify complaint belongs to customer
    const { data: complaint, error: complaintErr } = await adminClient
      .from("complaints")
      .select("*")
      .eq("id", complaint_id)
      .eq("customer_id", customer.id)
      .single();

    if (complaintErr || !complaint) {
      throw new HTTPError(404, "NOT_FOUND", "Complaint not found or does not belong to you");
    }

    // Update complaint status to indicate human support requested
    const { error: updateErr } = await adminClient
      .from("complaints")
      .update({ status: "assigned", priority: "P2" }) // Escalate priority
      .eq("id", complaint_id);

    if (updateErr) {
      throw new HTTPError(500, "UPDATE_FAILED", "Failed to request human support");
    }

    // Create status history entry
    await adminClient.from("complaint_status_history").insert({
      complaint_id,
      from_status: complaint.status,
      to_status: "assigned",
      changed_by: auth.user.id,
      note: "Customer requested human support via chatbot",
    });

    // Create or update support ticket
    const { data: existingTicket } = await adminClient
      .from("support_tickets")
      .select("id")
      .eq("complaint_id", complaint_id)
      .single();

    if (!existingTicket) {
      // Create new support ticket
      const ticketId = `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await adminClient.from("support_tickets").insert({
        id: ticketId,
        complaint_id,
        title: complaint.summary,
        description: complaint.detail,
        status: "open",
        priority: "P2",
        queue: "customer_support",
        customer_id: customer.id,
      });

      // Create ticket activity
      await adminClient.from("ticket_activity").insert({
        ticket_id: ticketId,
        event_type: "created",
        actor_id: auth.user.id,
        payload: { source: "customer_chatbot" },
      });
    }

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "COMPLAINT_ESCALATED",
      resourceType: "complaint",
      resourceId: complaint_id,
      requestId: (req as any).requestId,
      metadata: { source: "customer_chatbot" },
    });

    res.status(200).json({ data: { message: "Human support requested successfully" } });
  } catch (error) {
    next(error);
  }
};

export const getUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminClient = createSupabaseServiceRoleClient();
    const auth = (req as any).auth;
    const { filename, content_type } = req.body;
    
    // Generate a unique storage path for the file: {userId}/{timestamp}-{filename}
    // We use the auth.user.id (profile ID) as the folder name to match the storage policy
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `${auth.user.id}/${uniqueFilename}`;
    
    const { data, error } = await adminClient.storage
      .from('complaint-attachments')
      .createSignedUploadUrl(storagePath);
      
    if (error || !data) {
      throw new HTTPError(500, "UPLOAD_URL_FAILED", `Failed to generate upload URL: ${error?.message}`);
    }
    
    res.status(200).json({ 
      data: { 
        signedUrl: data.signedUrl,
        storagePath: storagePath 
      } 
    });
  } catch (error) {
    next(error);
  }
};
