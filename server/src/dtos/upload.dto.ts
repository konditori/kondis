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

const LagomTakeoutErrorSchema = z.object({
  row: z.number().int().positive().describe('One-based row number in activities.csv'),
  filename: z.string().describe('Filename from activities.csv'),
  message: z.string().describe('Reason this activity could not be imported'),
});

export const LagomTakeoutUploadResponseSchema = z
  .object({
    totalActivities: z.number().int().nonnegative().describe('Data rows found in activities.csv'),
    imported: z.number().int().nonnegative().describe('New activity files stored and queued for parsing'),
    duplicates: z.number().int().nonnegative().describe('Activity files already present in Kondis'),
    skipped: z.number().int().nonnegative().describe('Rows without a supported activity file'),
    failed: z.number().int().nonnegative().describe('Activity files that could not be imported'),
    uploads: z.array(FitUploadResponseSchema).describe('Successfully resolved Kondis uploads'),
    errors: z.array(LagomTakeoutErrorSchema).describe('Per-activity import errors'),
  })
  .meta({ id: 'LagomTakeoutUploadResponseDto' });

export class LagomTakeoutUploadResponseDto extends createZodDto(LagomTakeoutUploadResponseSchema) {}
