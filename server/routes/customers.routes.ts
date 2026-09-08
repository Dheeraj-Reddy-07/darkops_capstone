import { Router } from "express";
import {
  getCustomerOrders,
  getCustomerComplaints,
  getCustomerOrderById,
  getCustomerComplaintById,
  createComplaint,
  requestHumanSupport,
  getUploadUrl,
} from "../controllers/customers.controller";
import { handleCustomerChat } from "../controllers/chatbot.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validation";
import { rateLimit } from "../middleware/rateLimit";
import {
  CreateComplaintSchema,
  RequestSupportSchema,
  PaginationSchema,
  ChatbotMessagesSchema,
  UploadUrlSchema,
} from "../schemas/customer.schemas";

const router = Router();

router.use(requireAuth);

// Customer-specific routes - the controller handles customer resolution
router.get(
  "/me/orders",
  rateLimit(50, 60000),
  requirePermission("orders.read.own"),
  getCustomerOrders,
);
router.get(
  "/me/orders/:id",
  rateLimit(50, 60000),
  requirePermission("orders.read.own"),
  getCustomerOrderById,
);
router.get(
  "/me/complaints",
  rateLimit(50, 60000),
  requirePermission("customers.read.own"),
  getCustomerComplaints,
);
router.get(
  "/me/complaints/:id",
  rateLimit(50, 60000),
  requirePermission("customers.read.own"),
  getCustomerComplaintById,
);
router.post(
  "/me/complaints",
  rateLimit(5, 60000),
  requirePermission("customers.create_complaint"),
  validateBody(CreateComplaintSchema),
  createComplaint,
);
router.post(
  "/me/request-support",
  rateLimit(10, 60000),
  requirePermission("customers.read.own"),
  validateBody(RequestSupportSchema),
  requestHumanSupport,
);
router.post(
  "/me/upload-url",
  rateLimit(20, 60000),
  requirePermission("customers.create_complaint"),
  validateBody(UploadUrlSchema),
  getUploadUrl,
);
router.post(
  "/me/chat",
  rateLimit(20, 60000),
  requirePermission("customers.read.own"),
  validateBody(ChatbotMessagesSchema),
  handleCustomerChat,
);

export default router;
