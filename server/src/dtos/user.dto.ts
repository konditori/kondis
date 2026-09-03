import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const NewUserInputSchema = z.object({
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  password_hash: z.string(),
  role: z.enum(['admin', 'user']),
});

export type NewUserInput = z.infer<typeof NewUserInputSchema>;

export class NewUserInputDto extends createZodDto(NewUserInputSchema) {}
