import { Router } from "express";
import {
  getStores,
  getStoreById,
  getStorePulse,
  getStoreWorkOrders,
  createStoreWorkOrder,
} from "../controllers/stores.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateQuery } from "../middleware/validation";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  rateLimit(50, 60000),
  requirePermission(["stores.read.all", "stores.read.own"]),
  getStores,
);
router.get(
  "/:id",
  rateLimit(50, 60000),
  requirePermission(["stores.read.all", "stores.read.own"]),
  getStoreById,
);
router.get(
  "/:id/pulse",
  rateLimit(50, 60000),
  requirePermission(["stores.read.all", "stores.read.own"]),
  getStorePulse,
);
router.get(
  "/:id/work-orders",
  rateLimit(50, 60000),
  requirePermission(["stores.read.all", "stores.read.own"]),
  getStoreWorkOrders,
);
router.post(
  "/:id/work-orders",
  rateLimit(20, 60000),
  requirePermission("work_orders.manage"),
  createStoreWorkOrder,
);

export default router;
