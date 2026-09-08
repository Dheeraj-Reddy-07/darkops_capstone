/**
 * Data Transfer Object (DTO) utilities for data minimization
 * Filters sensitive data from database responses before sending to clients
 */

/**
 * Customer order DTO - removes sensitive internal fields
 */
export function toOrderDTO(order: any) {
  return {
    id: order.id,
    customer_id: order.customer_id,
    store_id: order.store_id,
    store_name: order.stores?.name || null,
    store_city: order.stores?.city || null,
    status: order.status,
    placed_at: order.placed_at,
    eta_at: order.eta_at,
    delivered_at: order.delivered_at,
    total_amount_paise: order.total_amount_paise,
    item_count: order.item_count,
    // Only include order items if present, or simulate from items_preview
    order_items: order.order_items
      ? order.order_items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price_paise: item.unit_price_paise,
        }))
      : order.items_preview
        ? order.items_preview.split(',').map((name: string) => ({
            name: name.trim(),
            quantity: 1,
            unit_price_paise: Math.floor((order.total_amount_paise || 0) / Math.max(1, order.item_count || 1))
          }))
        : [],
    // Also pass raw items_preview for direct string display
    items_preview: order.items_preview || null,
    // Delivery partner info (if available)
    delivery_partner: order.delivery_partner || null,
  };
}

/**
 * Customer complaint DTO - removes sensitive internal fields
 */
export function toComplaintDTO(complaint: any) {
  const createdAtMs = complaint.created_at ? new Date(complaint.created_at).getTime() : Date.now();
  const nowMs = Date.now();
  // SLA targets: P1 = 15m, P2 = 30m, P3 = 120m (2h), P4 = 240m (4h)
  const slaMinsMap: Record<string, number> = { P1: 15, P2: 30, P3: 120, P4: 240 };
  const slaMins = slaMinsMap[complaint.priority] || 120;

  // Prefer sla_due_at set by automation engine; fall back to computed value from priority + created_at
  const slaDueMs = complaint.sla_due_at
    ? new Date(complaint.sla_due_at).getTime()
    : createdAtMs + slaMins * 60 * 1000;

  const isOpen = complaint.status === "unassigned" || complaint.status === "assigned" || complaint.status === "in_progress";
  const isBreached = isOpen && nowMs > slaDueMs;

  // Customer-facing status label derived from real backend state
  let customerStatusLabel: string;
  let customerStatusDetail: string;

  if (complaint.status === "resolved" || complaint.status === "closed") {
    customerStatusLabel = complaint.status === "resolved" ? "Resolved" : "Closed";
    customerStatusDetail = complaint.resolution || "Your complaint has been resolved.";
  } else if (isBreached) {
    customerStatusLabel = "Response SLA Exceeded - Live support available";
    customerStatusDetail = "Our standard review window has passed. You are now eligible to connect with a live support agent on your complaint details page.";
  } else if (complaint.status === "assigned" || complaint.status === "in_progress") {
    customerStatusLabel = "Under review by support team";
    customerStatusDetail = "Your complaint is currently assigned to our support team and is being reviewed within SLA.";
  } else {
    // unassigned – automation has not yet processed it or it is still being routed
    customerStatusLabel = "Received — being processed";
    customerStatusDetail = "Your complaint has been received and is being processed by our automation engine.";
  }

  return {
    id: complaint.id,
    complaint_ref: complaint.complaint_ref,
    customer_id: complaint.customer_id,
    order_id: complaint.order_id,
    store_id: complaint.store_id,
    store_name: complaint.stores?.name || null,
    category: complaint.category,
    summary: complaint.summary,
    detail: complaint.detail,
    status: complaint.status,
    priority: complaint.priority,
    type: complaint.type,
    created_at: complaint.created_at,
    updated_at: complaint.updated_at,
    resolution: complaint.resolution || null,
    automation_result: complaint.automation_result || null,
    order_value_paise: complaint.order_value_paise,
    sla_due_at: new Date(slaDueMs).toISOString(),
    sla_breached: isBreached,
    is_live_call_eligible: isBreached,
    customer_status_label: customerStatusLabel,
    customer_status_detail: customerStatusDetail,
    // Attachments (metadata only)
    attachments: complaint.complaint_attachments
      ? complaint.complaint_attachments.map((att: any) => ({
          id: att.id,
          filename: att.filename,
          file_type: att.file_type,
          uploaded_at: att.uploaded_at,
        }))
      : undefined,
    // Status history – sorted ascending so timeline shows oldest-first
    status_history: complaint.complaint_status_history
      ? [...complaint.complaint_status_history]
          .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
          .map((h: any) => ({
            from_status: h.from_status,
            to_status: h.to_status,
            changed_at: h.changed_at,
            note: h.note,
          }))
      : undefined,
  };
}

/**
 * Customer profile DTO - removes sensitive internal fields
 */
export function toCustomerDTO(customer: any) {
  return {
    id: customer.id,
    full_name: customer.full_name,
    email: customer.email,
    phone: customer.phone || null,
    address: customer.address || null,
    city: customer.city || null,
    created_at: customer.created_at,
  };
}

/**
 * Support ticket DTO - removes sensitive internal fields
 */
export function toSupportTicketDTO(ticket: any) {
  return {
    id: ticket.id,
    complaint_id: ticket.complaint_id,
    customer_id: ticket.customer_id,
    store_id: ticket.store_id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    queue: ticket.queue,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };
}
