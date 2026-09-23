import { z } from "zod";

// Allowed statuses (allowlist for security)
const ALLOWED_STATUSES = [
  "unassigned",
  "assigned",
  "in_progress",
  "awaiting_customer",
  "escalated_l2",
  "resolved",
  "closed",
] as const;

// Allowed priorities
const ALLOWED_PRIORITIES = ["P1", "P2", "P3", "P4"] as const;

// Case assignment schema
export const AssignCaseSchema = z.object({
  agent_id: z.string().uuid(),
});

// Case escalation schema
export const EscalateCaseSchema = z.object({
  note: z.string().min(1).max(1000).optional(),
});

// Case resolution schema
export const ResolveCaseSchema = z.object({
  resolution: z.string().min(1).max(1000),
  note: z.string().min(1).max(1000).optional(),
});

// Case filtering schema (also exported as GetCasesQuerySchema for compatibility)
export const CaseFilterSchema = z
  .object({
    status: z.enum(ALLOWED_STATUSES).optional(),
    priority: z.enum(ALLOWED_PRIORITIES).optional(),
    category: z.string().optional(),
    assigned_agent_id: z.string().uuid().optional(),
    store_id: z.string().optional(),
  })
  .merge(
    z.object({
      page: z.coerce.number().int().positive().max(1000).default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    }),
  );

// Alias for existing code
export const GetCasesQuerySchema = CaseFilterSchema;

// Case comment schema
export const CaseCommentSchema = z.object({
  body: z.string().min(1).max(2000),
});
