import { z } from '@hono/zod-openapi';

export const NewUserInputSchema = z.object({
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  password_hash: z.string(),
  role: z.enum(['admin', 'user']),
});

export type NewUserInput = z.infer<typeof NewUserInputSchema>;

export type NewUserInputDto = z.output<typeof NewUserInputSchema>;
