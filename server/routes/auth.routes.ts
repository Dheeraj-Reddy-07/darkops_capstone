import { Router } from 'express';
import { getMe, updateMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.get('/me', rateLimit(50, 60000), requireAuth, getMe);
router.patch('/me', rateLimit(50, 60000), requireAuth, updateMe);

export default router;
