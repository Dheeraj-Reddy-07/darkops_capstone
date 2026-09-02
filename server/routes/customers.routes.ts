import { Router } from 'express';
import { getCustomerOrders, getCustomerComplaints, createComplaint } from '../controllers/customers.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { CreateComplaintSchema } from '../schemas/customer.schemas';

const router = Router();

router.use(requireAuth);

router.get('/me/orders', rateLimit(50, 60000), requirePermission('orders.read.own'), getCustomerOrders);
router.get('/me/complaints', rateLimit(50, 60000), requirePermission('customers.read.own'), getCustomerComplaints);
router.post('/me/complaints', rateLimit(5, 60000), requirePermission('customers.create_complaint'), validateBody(CreateComplaintSchema), createComplaint);

export default router;
