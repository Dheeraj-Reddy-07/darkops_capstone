import { z } from "zod";

export const FraudDecisionSchema = z.object({
  // Must match the DB `fraud_decision` enum (approved | denied | escalated).
  decision: z.enum(["approved", "denied", "escalated"]),
  note: z.string().optional(),
});
