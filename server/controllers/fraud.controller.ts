import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { logAudit } from "../services/audit.service";
import { HTTPError } from "../middleware/errors";

export const getFraudReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);

    const { data, error } = await supabase
      .from("fraud_reviews")
      .select(
        `
        *,
        complaints (summary, refund_amount_paise, store_id, order_id),
        customers (full_name, prior_claims_90d, email)
      `,
      )
      .order("flagged_at", { ascending: false });

    if (error) {
      throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);
    }

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const getFraudReviewById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { id } = req.params;

    const { data, error } = await supabase
      .from("fraud_reviews")
      .select(
        `
        *,
        complaints (*),
        customers (*),
        fraud_risk_factors (*)
      `,
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new HTTPError(404, "NOT_FOUND", "Fraud review not found or access denied");
    }

    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getFraudHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    const { id } = req.params;

    const { data, error } = await supabase
      .from("fraud_review_history")
      .select("*")
      .eq("fraud_review_id", id)
      .order("occurred_at", { ascending: false });

    if (error) {
      throw new HTTPError(500, "DATABASE_ERROR", `Database error: ${error.message}`);
    }

    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
};

export const makeFraudDecision = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { decision, note } = req.body;
    const auth = (req as any).auth;

    const adminClient = createSupabaseServiceRoleClient();

    const { data: review, error: fetchErr } = await adminClient
      .from("fraud_reviews")
      .select("id, decision, complaint_id, customer_id")
      .eq("id", id)
      .single();

    if (fetchErr || !review) throw new HTTPError(404, "NOT_FOUND", "Fraud review not found");
    if (review.decision !== "pending_review") {
      throw new HTTPError(409, "INVALID_STATE", "Decision has already been made on this review.");
    }

    const { error: updateErr } = await adminClient
      .from("fraud_reviews")
      .update({
        decision,
        decided_by: auth.user.id,
        decision_note: note || null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) throw new HTTPError(500, "UPDATE_FAILED", "Failed to update fraud decision");

    await adminClient.from("fraud_review_history").insert({
      fraud_review_id: id as string,
      actor_id: auth.user.id,
      actor_label: auth.user.role,
      action: `Decision: ${decision}`,
    });

    await logAudit({
      actorId: auth.user.id,
      actorRole: auth.user.role,
      action: "support.decide",
      resourceType: "fraud_review",
      resourceId: id,
      metadata: { decision },
    });

    // Create notification for operations team
    await adminClient.from("notifications").insert({
      recipient_id: null, // Will be set to operations manager
      title: `Fraud decision: ${decision}`,
      meta: `Fraud review ${id} has been ${decision}`,
      link_type: "fraud",
      link_ref: id,
    });

    res.status(200).json({ success: true, message: "Fraud decision recorded successfully" });
  } catch (error) {
    next(error);
  }
};
