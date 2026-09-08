import { Router } from "express";
import {
  getUsers,
  updateUserRole,
  getAuditLogs,
  getSystemStats,
} from "../controllers/admin.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateBody } from "../middleware/validation";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);

router.get("/stats", rateLimit(50, 60000), requirePermission("audit.read"), getSystemStats);
router.get("/users", rateLimit(50, 60000), requirePermission("admin.users"), getUsers);
router.patch(
  "/users/:id/role",
  rateLimit(20, 60000),
  requirePermission("admin.users"),
  updateUserRole,
);
router.get("/audit-logs", rateLimit(50, 60000), requirePermission("audit.read"), getAuditLogs);

export default router;
