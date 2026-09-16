import { z } from '@hono/zod-openapi';

export const CapabilitiesUploadLimitsSchema = z
  .object({
    activityFileBytes: z.number().int().nonnegative().describe('Maximum accepted activity file size in bytes'),
    imageFileBytes: z.number().int().nonnegative().describe('Maximum accepted activity image size in bytes'),
    avatarFileBytes: z.number().int().nonnegative().describe('Maximum accepted avatar image size in bytes'),
    zipEntries: z.number().int().nonnegative().describe('Maximum entry count in an uploaded ZIP archive'),
    zipEntryBytes: z.number().int().nonnegative().describe('Maximum expanded size of one ZIP entry in bytes'),
    zipExpandedBytes: z.number().int().nonnegative().describe('Maximum total expanded size of a ZIP archive in bytes'),
    zipCompressionRatio: z.number().int().nonnegative().describe('Maximum accepted ZIP compression ratio'),
    manifestBytes: z.number().int().nonnegative().describe('Maximum takeout manifest size in bytes'),
    manifestRows: z.number().int().nonnegative().describe('Maximum takeout manifest row count'),
  })
  .strict();

export const CapabilitiesUploadsSchema = z
  .object({
    activityExtensions: z.array(z.string()).describe('Accepted activity file extensions'),
    imageExtensions: z.array(z.string()).describe('Accepted activity image file extensions'),
    videoExtensions: z.array(z.string()).describe('Video file extensions recognized in takeout archives'),
    limits: CapabilitiesUploadLimitsSchema,
  })
  .strict();

export const CapabilitiesResponseSchema = z
  .object({
    uploads: CapabilitiesUploadsSchema.describe('Upload formats and limits for client-side parsing and UX'),
  })
  .strict()
  .openapi('CapabilitiesDto_Output');

export type CapabilitiesResponseDto = z.output<typeof CapabilitiesResponseSchema>;
