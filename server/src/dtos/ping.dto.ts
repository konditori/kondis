import { z } from '@hono/zod-openapi';

export const PingResponseSchema = z
  .object({
    status: z.string().describe('Health status of the API'),
  })
  .strict()
  .openapi('PingResponseDto_Output');

export type PingResponseDto = z.output<typeof PingResponseSchema>;
