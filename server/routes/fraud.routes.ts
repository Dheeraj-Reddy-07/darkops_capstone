import { Router } from 'express';
import { getFraudReviews, getFraudReviewById, getFraudHistory, makeFraudDecision } from '../controllers/fraud.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { FraudDecisionSchema } from '../schemas/fraud.schemas';

const router = Router();

router.use(requireAuth);

router.get('/', rateLimit(50, 60000), requirePermission('support.read'), getFraudReviews);
router.get('/:id', rateLimit(50, 60000), requirePermission('support.read'), getFraudReviewById);
router.get('/:id/history', rateLimit(50, 60000), requirePermission('support.read'), getFraudHistory);
router.post('/:id/decision', rateLimit(20, 60000), requirePermission('support.decide'), validateBody(FraudDecisionSchema), makeFraudDecision);

export default router;
