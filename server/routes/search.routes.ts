import { Router } from "express";
import { searchEntities } from "../controllers/search.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);

router.get("/", rateLimit(60, 60000), searchEntities);

export default router;
