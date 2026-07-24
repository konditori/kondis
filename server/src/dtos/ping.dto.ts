import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const PingResponseSchema = z
  .object({
    status: z.string().describe('Health status of the API'),
  })
  .meta({ id: 'PingResponseDto' });

export class PingResponseDto extends createZodDto(PingResponseSchema) {}