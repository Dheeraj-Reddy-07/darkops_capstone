import { Router } from "express";
import {
  acknowledgeResolutionDecision,
  issueUpstreamHandoffToken,
} from "../controllers/integration.controller";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

// Public token issuance simulation endpoint (stub upstream platform)
router.post("/handoff/issue", rateLimit(60, 60000), issueUpstreamHandoffToken);

// Public / system callback for simulated commerce platform
router.post(
  "/commerce/acknowledge",
  rateLimit(60, 60000),
  acknowledgeResolutionDecision,
);

export default router;
