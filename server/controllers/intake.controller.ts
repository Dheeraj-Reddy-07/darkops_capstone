/**
 * Intake Controller
 *
 * Implements the externally-facing complaint intake API.
 * This is the bridge between the quick-commerce platform and DarkOps.
 *
 * Authentication: HMAC-SHA256 signature verification
 * - Header: X-DarkOps-Signature: sha256=<hex>
 * - Header: X-DarkOps-Timestamp: <unix ms>
 * - Signed payload: `${timestamp}.${rawBody}`
 * - Secret: INTAKE_WEBHOOK_SECRET env variable
 *
 * Flow:
 *   1. Verify HMAC signature
 *   2. Validate payload (customer, order, category, details)
 *   3. Resolve or create customer record
 *   4. Create complaint
 *   5. Fire processComplaint() asynchronously
 *   6. Return signed webhook response
 */

import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { createSupabaseServiceRoleClient } from "../lib/supabase";
import { processComplaint } from "../services/automation.service";
import { logAudit } from "../services/audit.service";
import { HTTPError } from "../middleware/errors";

// ─── HMAC Verification ───────────────────────────────────────────────────────

const INTAKE_SECRET = process.env.INTAKE_WEBHOOK_SECRET || "darkops-dev-intake-secret";
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000; // 5 minutes

function verifyHmac(rawBody: string, signature: string, timestamp: string): boolean {
  try {
    // Reject stale requests
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts) || Math.abs(Date.now() - ts) > MAX_TIMESTAMP_SKEW_MS) {
      return false;
    }

    // Compute expected signature
    const payload = `${timestamp}.${rawBody}`;
    const expected = createHmac("sha256", INTAKE_SECRET).update(payload).digest("hex");
    const expectedFull = `sha256=${expected}`;

    // Timing-safe comparison
    if (signature.length !== expectedFull.length) return false;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedFull));
  } catch {
    return false;
  }
}

function signResponse(data: object): { signature: string; data: object } {
  const body = JSON.stringify(data);
  const ts = Date.now().toString();
  const payload = `${ts}.${body}`;
  const sig = `sha256=${createHmac("sha256", INTAKE_SECRET).update(payload).digest("hex")}`;
  return { signature: sig, data };
}

// ─── Allowed categories ───────────────────────────────────────────────────────

const ALLOWED_CATEGORIES = new Set([
  "wrong_item",
  "missing_item",
  "late_delivery",
  "damaged_item",
  "quality_issue",
  "payment_issue",
  "other",
]);

const CATEGORY_TO_SUMMARY: Record<string, string> = {
  wrong_item: "Wrong item received",
  missing_item: "Missing item",
  late_delivery: "Late delivery",
  damaged_item: "Damaged item",
  quality_issue: "Quality issue",
  payment_issue: "Payment issue",
  other: "Support request",
};

const CATEGORY_TO_TYPE: Record<string, string> = {
  wrong_item: "operational_investigation",
  missing_item: "operational_investigation",
  late_delivery: "operational_investigation",
  damaged_item: "refund",
  quality_issue: "refund",
  payment_issue: "refund",
  other: "operational_investigation",
};

// ─── Main Intake Handler ─────────────────────────────────────────────────────

export const intakeComplaint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Capture raw body for HMAC verification
    //    (We trust express.json() already parsed req.body; reconstruct the raw body)
    const rawBody = JSON.stringify(req.body);
    const signature = (req.headers["x-darkops-signature"] as string) || "";
    const timestamp = (req.headers["x-darkops-timestamp"] as string) || "";

    // 2. Verify HMAC
    if (!verifyHmac(rawBody, signature, timestamp)) {
      console.warn(
        `[INTAKE] HMAC verification failed - IP: ${req.ip}, TS: ${timestamp}, Sig: ${signature?.slice(0, 20)}...`,
      );
      throw new HTTPError(401, "INVALID_SIGNATURE", "Request signature verification failed.");
    }

    // 3. Validate required fields
    const { customer_email, order_id, category, details, platform_ref } = req.body;

    if (!customer_email || typeof customer_email !== "string") {
      throw new HTTPError(400, "MISSING_FIELD", "customer_email is required");
    }
    if (!order_id || typeof order_id !== "string") {
      throw new HTTPError(400, "MISSING_FIELD", "order_id is required");
    }
    if (!category || !ALLOWED_CATEGORIES.has(category)) {
      throw new HTTPError(
        400,
        "INVALID_CATEGORY",
        `category must be one of: ${[...ALLOWED_CATEGORIES].join(", ")}`,
      );
    }
    if (!details || typeof details !== "string" || details.trim().length < 10) {
      throw new HTTPError(400, "MISSING_FIELD", "details must be at least 10 characters");
    }

    const adminClient = createSupabaseServiceRoleClient();

    // 4. Resolve customer by email
    const { data: customer, error: customerErr } = await adminClient
      .from("customers")
      .select("id, email")
      .eq("email", customer_email.toLowerCase().trim())
      .maybeSingle();

    if (customerErr || !customer) {
      throw new HTTPError(
        404,
        "CUSTOMER_NOT_FOUND",
        `No customer found for email: ${customer_email}`,
      );
    }

    // 5. Validate order belongs to customer
    const { data: order, error: orderErr } = await adminClient
      .from("orders")
      .select("id, store_id, total_amount_paise")
      .eq("id", order_id)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (orderErr || !order) {
      throw new HTTPError(
        400,
        "INVALID_ORDER",
        `Order ${order_id} not found or does not belong to this customer`,
      );
    }

    // 6. Create complaint
    const complaintId = `CMP-INT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const complaintRef = `REF-INT-${platform_ref || Date.now()}`;
    const summary = CATEGORY_TO_SUMMARY[category] || "Support request";
    const dbType = CATEGORY_TO_TYPE[category] || "operational_investigation";

    const { error: insertErr } = await adminClient.from("complaints").insert({
      id: complaintId,
      complaint_ref: complaintRef,
      customer_id: customer.id,
      order_id,
      store_id: order.store_id,
      category,
      summary,
      detail: details.trim(),
      type: dbType,
      status: "unassigned",
      priority: "P3",
      order_value_paise: order.total_amount_paise || 0,
    });

    if (insertErr) {
      throw new HTTPError(
        500,
        "INSERT_FAILED",
        `Failed to create complaint: ${insertErr.message}`,
      );
    }

    // 7. Insert initial status history
    await adminClient
      .from("complaint_status_history")
      .insert({
        complaint_id: complaintId,
        from_status: null,
        to_status: "unassigned",
        changed_by: null,
        note: "Complaint received via external intake API",
      })
      .catch((e: any) => console.error("[INTAKE] Status history error:", e));

    // 8. Fire async processing (non-blocking)
    processComplaint(complaintId).catch((e) =>
      console.error("[INTAKE] processComplaint error:", e),
    );

    // 9. Audit log
    await logAudit({
      actorId: "INTAKE_API",
      actorRole: "EXTERNAL",
      action: "COMPLAINT_CREATED",
      resourceType: "complaint",
      resourceId: complaintId,
      requestId: req.requestId,
      metadata: {
        source: "external_intake",
        platform_ref,
        customer_email,
        order_id,
        category,
      },
    });

    // 10. Return signed response
    const responsePayload = {
      success: true,
      complaint_id: complaintId,
      complaint_ref: complaintRef,
      status: "received",
      message: "Complaint received and queued for processing",
    };

    const { signature: respSig, data: respData } = signResponse(responsePayload);
    res.setHeader("X-DarkOps-Response-Signature", respSig);
    res.setHeader("X-DarkOps-Timestamp", Date.now().toString());

    return res.status(202).json(respData);
  } catch (error) {
    next(error);
  }
};

// ─── Test / Connectivity Check ────────────────────────────────────────────────

export const intakeWebhookTest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timestamp = Date.now().toString();
    const testPayload = { status: "ok", message: "DarkOps intake API is reachable", timestamp };
    const body = JSON.stringify(testPayload);
    const sig = `sha256=${createHmac("sha256", INTAKE_SECRET).update(`${timestamp}.${body}`).digest("hex")}`;

    res.setHeader("X-DarkOps-Response-Signature", sig);
    res.setHeader("X-DarkOps-Timestamp", timestamp);
    res.status(200).json(testPayload);
  } catch (error) {
    next(error);
  }
};
