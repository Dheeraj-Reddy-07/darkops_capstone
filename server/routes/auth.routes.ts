import { Router } from "express";
import { getMe, updateMe, verifyHandoff } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.get("/me", rateLimit(50, 60000), requireAuth, getMe);
router.patch("/me", rateLimit(50, 60000), requireAuth, updateMe);

// Handoff verification endpoint (public pre-authentication route)
router.post("/handoff/verify", rateLimit(30, 60000), verifyHandoff);

export default router;
