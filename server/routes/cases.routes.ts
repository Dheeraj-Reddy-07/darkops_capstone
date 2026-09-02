import { Router } from 'express';
import { getCases, getCaseById, assignCaseHandler, escalateCaseHandler, resolveCaseHandler, getOperationsMetrics, getAgents } from '../controllers/cases.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { GetCasesQuerySchema, AssignCaseSchema, EscalateCaseSchema, ResolveCaseSchema } from '../schemas/case.schemas';

const router = Router();

// Apply auth middleware to all routes in this router
router.use(requireAuth);

router.get('/metrics', rateLimit(50, 60000), getOperationsMetrics);
router.get('/', rateLimit(50, 60000), requirePermission(['cases.read.all', 'cases.read.assigned']), getCases);
router.get('/:id', rateLimit(50, 60000), requirePermission(['cases.read.all', 'cases.read.assigned']), getCaseById);
router.post('/:id/assign', rateLimit(20, 60000), requirePermission('cases.assign'), validateBody(AssignCaseSchema), assignCaseHandler);
router.post('/:id/escalate', rateLimit(20, 60000), requirePermission('cases.escalate'), validateBody(EscalateCaseSchema), escalateCaseHandler);
router.post('/:id/resolve', rateLimit(20, 60000), requirePermission('cases.resolve'), validateBody(ResolveCaseSchema), resolveCaseHandler);
router.get('/agents', rateLimit(30, 60000), requirePermission(['cases.assign', 'cases.read.all']), getAgents);

export default router;
