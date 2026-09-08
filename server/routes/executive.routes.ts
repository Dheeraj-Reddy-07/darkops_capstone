import { Router } from "express";
import { getMetrics, getInsights, chatInsights } from "../controllers/executive.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);
router.use(requirePermission("executive.read"));

router.get("/metrics", rateLimit(50, 60000), getMetrics);
router.get("/insights", rateLimit(20, 60000), getInsights);
router.post("/insights/chat", rateLimit(20, 60000), chatInsights);

export default router;
