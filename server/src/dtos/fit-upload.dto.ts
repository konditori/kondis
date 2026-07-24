import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const FitUploadResponseSchema = z
  .object({
    fileName: z.string().describe('Stored file name'),
    byteSize: z.number().int().nonnegative().describe('Stored file size in bytes'),
    path: z.string().describe('Absolute path to the stored file'),
  })
  .meta({ id: 'FitUploadResponseDto' });

export class FitUploadResponseDto extends createZodDto(FitUploadResponseSchema) {}
