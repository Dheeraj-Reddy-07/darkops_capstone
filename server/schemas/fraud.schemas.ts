import { z } from "zod";

export const FraudDecisionSchema = z.object({
  decision: z.enum(["approved", "denied", "escalated_l3"]),
  note: z.string().optional(),
});
