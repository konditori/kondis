import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const FitUploadResponseSchema = z
  .object({
    id: z.string().describe('Upload id'),
    checksum: z.string().describe('Lowercase xxh128 hash of file contents'),
    byteSize: z.number().int().nonnegative().describe('Stored file size in bytes'),
    duplicate: z.boolean().describe('True when identical content was already stored'),
  })
  .meta({ id: 'FitUploadResponseDto' });

export class FitUploadResponseDto extends createZodDto(FitUploadResponseSchema) {}

export const LagomTakeoutUploadResponseSchema = z
  .object({
    checksum: z.string().describe('Lowercase xxh128 hash of file contents'),
    byteSize: z.number().int().nonnegative().describe('Uploaded takeout size in bytes'),
    queued: z.literal(true).describe('True when the takeout import was submitted to the queue'),
  })
  .meta({ id: 'LagomTakeoutUploadResponseDto' });

export class LagomTakeoutUploadResponseDto extends createZodDto(LagomTakeoutUploadResponseSchema) {}
