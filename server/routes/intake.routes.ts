import { Router } from "express";
import { intakeComplaint, intakeWebhookTest } from "../controllers/intake.controller";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

// External intake endpoint - HMAC authenticated (no session required)
// POST /api/v1/intake/complaints
router.post(
  "/complaints",
  rateLimit(20, 60000), // 20 per minute per IP
  intakeComplaint,
);

// Webhook test endpoint - verifies HMAC signature and connectivity
// GET /api/v1/intake/test
router.get("/test", rateLimit(5, 60000), intakeWebhookTest);

export default router;
