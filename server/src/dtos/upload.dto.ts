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
  })
  .meta({ id: 'LagomTakeoutUploadResponseDto' });

export class LagomTakeoutUploadResponseDto extends createZodDto(LagomTakeoutUploadResponseSchema) {}
