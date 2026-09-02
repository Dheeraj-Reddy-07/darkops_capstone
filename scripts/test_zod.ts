import { z } from 'zod';

const schema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const reqQuery = Object.create(null);

try {
  console.log(schema.parse(reqQuery));
} catch (e) {
  console.log(e);
}
