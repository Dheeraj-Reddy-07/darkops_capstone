import { Router } from "express";
import {
  getSecurityMetrics,
  getSecurityEvents,
  getAuditLogs,
  getUserActivity,
  getSecurityOverview,
} from "../controllers/security.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateQuery } from "../middleware/validation";
import {
  SecurityEventFilterSchema,
  AuditLogFilterSchema,
  UserActivityFilterSchema,
  SecurityMetricsSchema,
} from "../schemas/security.schemas";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);

// Security overview (PLATFORM_ADMIN only)
router.get(
  "/overview",
  rateLimit(30, 60000),
  requirePermission("security.read"),
  getSecurityOverview,
);

// Security metrics (PLATFORM_ADMIN only)
router.get(
  "/metrics",
  rateLimit(30, 60000),
  requirePermission("security.read"),
  validateQuery(SecurityMetricsSchema),
  getSecurityMetrics,
);

// Security events (PLATFORM_ADMIN only)
router.get(
  "/events",
  rateLimit(30, 60000),
  requirePermission("security.read"),
  validateQuery(SecurityEventFilterSchema),
  getSecurityEvents,
);

// Audit logs (PLATFORM_ADMIN only)
router.get(
  "/audit-logs",
  rateLimit(30, 60000),
  requirePermission("security.read"),
  validateQuery(AuditLogFilterSchema),
  getAuditLogs,
);

// User activity (PLATFORM_ADMIN only)
router.get(
  "/user-activity",
  rateLimit(30, 60000),
  requirePermission("security.read"),
  validateQuery(UserActivityFilterSchema),
  getUserActivity,
);

export default router;
