import { Router } from "express";
import {
  // New agent workspace endpoints
  getMyStats,
  getMyTickets,
  getTeamTickets,
  getUnassignedTickets,
  getMyResolvedTickets,
  getTicketActivity,
  updateTicketStatus,
  assignTicket,
  resolveTicket,
  addTicketNote,
  getAttachmentUploadUrl,
  createAttachmentRecord,
  getAttachmentDownloadUrl,
  deleteAttachment,
  // Legacy / kept endpoints
  getSupportTicketById,
  getFailedAutomationQueue,
  createSupportTicket,
  resolveFailedAutomation,
} from "../controllers/support.controller";
import { requireAuth, requirePermission } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

const router = Router();

router.use(requireAuth);

// ── Agent personal workspace ─────────────────────────────────────────────────
router.get("/me/stats", rateLimit(60, 60000), requirePermission("support.read"), getMyStats);
router.get("/me/tickets", rateLimit(60, 60000), requirePermission("support.read"), getMyTickets);
router.get(
  "/me/resolved",
  rateLimit(60, 60000),
  requirePermission("support.read"),
  getMyResolvedTickets,
);

// ── Team and unassigned queues ───────────────────────────────────────────────
router.get(
  "/team/tickets",
  rateLimit(60, 60000),
  requirePermission("support.read"),
  getTeamTickets,
);
router.get(
  "/unassigned/tickets",
  rateLimit(60, 60000),
  requirePermission("support.read"),
  getUnassignedTickets,
);

// ── Ticket detail and mutations ──────────────────────────────────────────────
router.get(
  "/tickets/:id",
  rateLimit(60, 60000),
  requirePermission("support.read"),
  getSupportTicketById,
);
router.get(
  "/tickets/:id/activity",
  rateLimit(60, 60000),
  requirePermission("support.read"),
  getTicketActivity,
);
router.patch(
  "/tickets/:id/status",
  rateLimit(30, 60000),
  requirePermission("support.decide"),
  updateTicketStatus,
);
router.patch(
  "/tickets/:id/assign",
  rateLimit(30, 60000),
  requirePermission("support.decide"),
  assignTicket,
);
router.post(
  "/tickets/:id/resolve",
  rateLimit(20, 60000),
  requirePermission("support.decide"),
  resolveTicket,
);
router.post(
  "/tickets/:id/notes",
  rateLimit(30, 60000),
  requirePermission("support.review"),
  addTicketNote,
);

// ── Attachments ──────────────────────────────────────────────────────────────
router.get(
  "/tickets/:id/attachments/upload-url",
  rateLimit(20, 60000),
  requirePermission("support.review"),
  getAttachmentUploadUrl,
);
router.post(
  "/tickets/:id/attachments",
  rateLimit(20, 60000),
  requirePermission("support.review"),
  createAttachmentRecord,
);
router.get(
  "/tickets/:id/attachments/:attachmentId/download",
  rateLimit(30, 60000),
  requirePermission("support.read"),
  getAttachmentDownloadUrl,
);
router.delete(
  "/tickets/:id/attachments/:attachmentId",
  rateLimit(20, 60000),
  requirePermission("support.review"),
  deleteAttachment,
);

// ── Ticket creation ──────────────────────────────────────────────────────────
router.post(
  "/tickets",
  rateLimit(20, 60000),
  requirePermission("support.review"),
  createSupportTicket,
);

// ── Failed automation queue ──────────────────────────────────────────────────
router.get(
  "/failed-automation",
  rateLimit(60, 60000),
  requirePermission("support.read"),
  getFailedAutomationQueue,
);
router.put(
  "/failed-automation/:id/resolve",
  rateLimit(20, 60000),
  requirePermission("support.decide"),
  resolveFailedAutomation,
);

export default router;
