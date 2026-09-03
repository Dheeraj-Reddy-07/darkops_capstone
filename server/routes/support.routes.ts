import { Router } from 'express';
import {
  getSupportTickets,
  getSupportTicketById,
  getFailedAutomationQueue,
  createSupportTicket,
  updateSupportTicket,
  getTicketHistory,
  resolveFailedAutomation
} from '../controllers/support.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.use(requireAuth);

// Support tickets
router.get('/tickets', rateLimit(50, 60000), requirePermission('support.read'), getSupportTickets);
router.get('/tickets/:id', rateLimit(50, 60000), requirePermission('support.read'), getSupportTicketById);
router.post('/tickets', rateLimit(20, 60000), requirePermission('support.review'), createSupportTicket);
router.put('/tickets/:id', rateLimit(20, 60000), requirePermission('support.decide'), updateSupportTicket);
router.get('/tickets/:id/history', rateLimit(50, 60000), requirePermission('support.read'), getTicketHistory);

// Failed automation queue
router.get('/failed-automation', rateLimit(50, 60000), requirePermission('support.read'), getFailedAutomationQueue);
router.put('/failed-automation/:id/resolve', rateLimit(20, 60000), requirePermission('support.decide'), resolveFailedAutomation);

export default router;
