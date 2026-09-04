import { z } from '@hono/zod-openapi';
import { createZodDto } from 'nestjs-zod';

export const FitUploadResponseSchema = z.object({
  byteSize: z.number().int().nonnegative().describe('Uploaded activity file size in bytes'),
  queued: z.literal(true).describe('True when activity processing was submitted to the queue'),
});

export class FitUploadResponseDto extends createZodDto(FitUploadResponseSchema) {}

export const LagomTakeoutUploadResponseSchema = z.object({
  byteSize: z.number().int().nonnegative().describe('Uploaded takeout size in bytes'),
  queued: z.literal(true).describe('True when the takeout import was submitted to the queue'),
  importId: z.string().uuid().describe('Identifier used to poll import progress'),
});

export class LagomTakeoutUploadResponseDto extends createZodDto(LagomTakeoutUploadResponseSchema) {}

export const TakeoutImportStatusSchema = z.object({
  importId: z.string().uuid(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  total: z.number().int().nonnegative().nullable(),
  processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  error: z.string().nullable(),
});

export class TakeoutImportStatusDto extends createZodDto(TakeoutImportStatusSchema) {}
