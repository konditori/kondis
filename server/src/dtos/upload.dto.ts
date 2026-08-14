import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const FitUploadResponseSchema = z
  .object({
    byteSize: z.number().int().nonnegative().describe('Uploaded activity file size in bytes'),
    queued: z.literal(true).describe('True when activity processing was submitted to the queue'),
  })
  .meta({ id: 'FitUploadResponseDto' });

export class FitUploadResponseDto extends createZodDto(FitUploadResponseSchema) {}

export const LagomTakeoutUploadResponseSchema = z
  .object({
    byteSize: z.number().int().nonnegative().describe('Uploaded takeout size in bytes'),
    queued: z.literal(true).describe('True when the takeout import was submitted to the queue'),
    importId: z.string().uuid().describe('Identifier used to poll import progress'),
  })
  .meta({ id: 'LagomTakeoutUploadResponseDto' });

export class LagomTakeoutUploadResponseDto extends createZodDto(LagomTakeoutUploadResponseSchema) {}

export const TakeoutImportStatusSchema = z
  .object({
    importId: z.string().uuid(),
    status: z.enum(['queued', 'processing', 'completed', 'failed']),
    total: z.number().int().nonnegative().nullable(),
    processed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    duplicates: z.number().int().nonnegative(),
    error: z.string().nullable(),
  })
  .meta({ id: 'TakeoutImportStatusDto' });

export class TakeoutImportStatusDto extends createZodDto(TakeoutImportStatusSchema) {}
