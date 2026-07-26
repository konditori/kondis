import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const FitUploadResponseSchema = z
  .object({
    id: z.string().describe('Upload identifier, used to correlate the resulting activity'),
    checksum: z.string().describe('Lowercase hex SHA-256 of the file contents'),
    byteSize: z.number().int().nonnegative().describe('Stored file size in bytes'),
    duplicate: z.boolean().describe('True when identical content was already stored'),
  })
  .meta({ id: 'FitUploadResponseDto' });

export class FitUploadResponseDto extends createZodDto(FitUploadResponseSchema) {}
