import { z } from '@hono/zod-openapi';
import { createZodDto } from 'nestjs-zod';

export const PingResponseSchema = z
  .object({
    status: z.string().describe('Health status of the API'),
  })
  .strict()
  .openapi('PingResponseDto_Output');

export class PingResponseDto extends createZodDto(PingResponseSchema) {}
