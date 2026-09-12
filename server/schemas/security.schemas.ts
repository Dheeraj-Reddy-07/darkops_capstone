import { z } from "zod";

// Security event filter schema
export const SecurityEventFilterSchema = z
  .object({
    action: z.string().optional(),
    actor_id: z.string().optional(),
    actor_role: z.string().optional(),
    resource_type: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .merge(
    z.object({
      page: z.coerce.number().int().positive().max(1000).default(1),
      limit: z.coerce.number().int().positive().max(100).default(50),
    }),
  );

// Audit log filter schema
export const AuditLogFilterSchema = z
  .object({
    action: z.string().optional(),
    actor_id: z.string().optional(),
    actor_role: z.string().optional(),
    resource_type: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .merge(
    z.object({
      page: z.coerce.number().int().positive().max(1000).default(1),
      limit: z.coerce.number().int().positive().max(100).default(50),
    }),
  );

// Security metrics schema
export const SecurityMetricsSchema = z.object({
  period: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return "7d";
      if (val === "24h" || val === "7d" || val === "30d") return val;
      return "7d"; // default to 7d if invalid
    })
    .default("7d"),
});

// User activity filter schema
export const UserActivityFilterSchema = z
  .object({
    user_id: z.string().optional(),
    role: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })
  .merge(
    z.object({
      page: z.coerce.number().int().positive().max(1000).default(1),
      limit: z.coerce.number().int().positive().max(100).default(50),
    }),
  );
