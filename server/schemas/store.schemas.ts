import { z } from "zod";

export const GetStoresQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  city: z.string().optional(),
  zone: z.string().optional(),
});
