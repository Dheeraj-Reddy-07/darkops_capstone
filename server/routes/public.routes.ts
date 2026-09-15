import { Router } from "express";
import { getPublicOverview } from "../controllers/public.controller";

const router = Router();

/**
 * Public routes - no authentication required.
 * Returns only safe, aggregate network statistics for the landing page.
 */

// GET /api/v1/public/overview
router.get("/overview", getPublicOverview);

export default router;
