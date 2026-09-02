import { z } from 'zod';

export const GetCasesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['unassigned', 'assigned', 'in_progress', 'escalated_l2', 'escalated_fraud', 'resolved']).optional(),
  priority: z.enum(['P1', 'P2', 'P3']).optional(),
});

export const AssignCaseSchema = z.object({
  agent_id: z.string().uuid(),
});

export const EscalateCaseSchema = z.object({
  note: z.string().min(1, 'Escalation note is required'),
});

export const ResolveCaseSchema = z.object({
  resolution: z.enum(['refund_issued', 'replacement_sent', 'apology_given', 'rejected']),
  note: z.string().optional(),
});
