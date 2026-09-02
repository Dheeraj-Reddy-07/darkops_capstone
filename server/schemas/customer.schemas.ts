import { z } from 'zod';

export const CreateComplaintSchema = z.object({
  order_id: z.string(),
  category: z.string().min(1),
  details: z.string().min(10),
});
