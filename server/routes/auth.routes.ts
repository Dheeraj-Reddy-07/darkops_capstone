import { Router } from 'express';
import { getMe } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

router.get('/me', rateLimit(50, 60000), requireAuth, getMe);

export default router;
