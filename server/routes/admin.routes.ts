import { Router } from "express";
import {
  getUsers,
  updateUserRole,
  updateUserStatus,
  getAuditLogs,
  getSystemStats,
  getAdminStores,
  updateAdminStore,
} from "../controllers/admin.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
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
router.patch(
  "/users/:id/status",
  rateLimit(20, 60000),
  requirePermission("admin.users"),
  updateUserStatus,
);

router.get("/stores", rateLimit(50, 60000), requirePermission("admin.system"), getAdminStores);
router.patch(
  "/stores/:id",
  rateLimit(20, 60000),
  requirePermission("admin.system"),
  updateAdminStore,
);

router.get("/audit-logs", rateLimit(50, 60000), requirePermission("audit.read"), getAuditLogs);

export default router;
