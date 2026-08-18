import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const ActivityEventsTicketSchema = z
  .object({
    token: z.string().min(20),
    expiresAt: z.string().datetime(),
  })
  .meta({ id: 'ActivityEventsTicketDto' });

export class ActivityEventsTicketDto extends createZodDto(ActivityEventsTicketSchema) {}
