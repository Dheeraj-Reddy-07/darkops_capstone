import { Router } from "express";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from "../controllers/notifications.controller";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);

router.get("/", rateLimit(50, 60000), getNotifications);
router.get("/unread-count", rateLimit(50, 60000), getUnreadCount);
router.patch("/:id/read", rateLimit(20, 60000), markNotificationRead);
router.patch("/read-all", rateLimit(20, 60000), markAllNotificationsRead);

export default router;
