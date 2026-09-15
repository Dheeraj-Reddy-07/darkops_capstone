// Integration Controller for Upstream Commerce Platform Simulation
// Handles resolution handoff callbacks, HMAC signature verification, and downstream acknowledgements.

import { Request, Response, NextFunction } from "express";
import {
  acknowledgeHandoff,
  verifyHandoffSignature,
  issueHandoffToken,
} from "../services/handoff.service";
import { HTTPError } from "../middleware/errors";
import { logAudit } from "../services/audit.service";

/**
 * POST /api/v1/integration/handoff/issue
 * Simulated upstream commerce logic (10MinMart backend) issuing a signed handoff token.
 */
export const issueUpstreamHandoffToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { customer_id, order_id, issue_category, ttlSeconds } = req.body;

    if (!customer_id || !order_id) {
      throw new HTTPError(400, "INVALID_INPUT", "customer_id and order_id are required");
    }

    const result = await issueHandoffToken({
      customer_id,
      order_id,
      issue_category,
      ttlSeconds,
    });

    res.status(200).json({
      success: true,
      token: result.token,
      handoff_url: `/report-issue?handoff=${result.token}`,
      payload: result.payload,
    });
  } catch (error: any) {
    if (
      error?.message?.includes("Unauthorized") ||
      error?.message?.includes("Invalid order_id")
    ) {
      next(
        new HTTPError(
          403,
          "UNAUTHORIZED_ISSUANCE",
          "Token issuance forbidden: Requested customer or order context is not authorized",
        ),
      );
    } else {
      next(error);
    }
  }
};

/**
 * POST /api/v1/integration/commerce/acknowledge
 * Endpoint simulated for upstream commerce/logistics system to acknowledge DarkOps resolution decision.
 */
export const acknowledgeResolutionDecision = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { handoff_id, downstream_reference } = req.body;
    const signatureHeader = req.headers["x-darkops-signature"] as string;

    if (!handoff_id) {
      throw new HTTPError(400, "INVALID_INPUT", "handoff_id is required");
    }

    // Optional signature validation if provided by client
    if (signatureHeader && req.body.payload) {
      const isValid = verifyHandoffSignature(req.body.payload, signatureHeader);
      if (!isValid) {
        throw new HTTPError(401, "INVALID_SIGNATURE", "HMAC signature verification failed");
      }
    }

    const downstreamRef = downstream_reference || `COMMERCE-ACK-${Date.now()}`;
    const updatedHandoff = await acknowledgeHandoff(handoff_id, downstreamRef);

    await logAudit({
      actorId: "00000000-0000-0000-0000-000000000000",
      actorRole: "integration",
      action: "integration.resolution_acknowledged",
      resourceType: "execution_handoff",
      resourceId: handoff_id,
      metadata: { downstream_reference: downstreamRef },
    });

    res.json({
      success: true,
      message: "Upstream commerce platform successfully acknowledged resolution decision",
      handoff: updatedHandoff,
    });
  } catch (error) {
    next(error);
  }
};
