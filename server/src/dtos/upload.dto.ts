import { z } from '@hono/zod-openapi';

import { ACTIVITY_TAG_IDS } from 'src/constants';
import { ActivityType } from 'src/enum';

const ActivityTypeSchema = z.enum(ActivityType);
const ActivityTagSchema = z.enum(ACTIVITY_TAG_IDS);

export const FitUploadResponseSchema = z.object({
  byteSize: z.number().int().nonnegative().describe('Uploaded activity file size in bytes'),
  queued: z.literal(true).describe('True when activity processing was submitted to the queue'),
});
export type FitUploadResponseDto = z.output<typeof FitUploadResponseSchema>;

export const TakeoutImportCreateResponseSchema = z.object({
  importId: z.string().uuid(),
  status: z.literal('scanning'),
});

export const TakeoutActivityMetadataSchema = z.object({
  itemKey: z.string().min(1).max(1024),
  originalName: z.string().min(1).max(512),
  name: z.string().max(200).nullable(),
  description: z.string().max(10_000).nullable(),
  sport: ActivityTypeSchema.optional(),
  tags: z.array(ActivityTagSchema).max(20),
});

const NullableMetricSchema = z.number().finite().nullable();
export const TakeoutManualItemSchema = z.object({
  itemKey: z.string().min(1).max(1024),
  kind: z.literal('manual'),
  sourceId: z.string().min(1).max(512),
  name: z.string().max(200).nullable(),
  description: z.string().max(10_000).nullable(),
  sport: ActivityTypeSchema,
  tags: z.array(ActivityTagSchema).max(20),
  startedAt: z.string().datetime(),
  elapsedTime: z.number().int().nonnegative(),
  movingTime: z.number().int().nonnegative().nullable(),
  distance: NullableMetricSchema,
  elevationGain: NullableMetricSchema,
  elevationLoss: NullableMetricSchema,
  avgSpeed: NullableMetricSchema,
  maxSpeed: NullableMetricSchema,
  avgHr: NullableMetricSchema,
  maxHr: NullableMetricSchema,
  calories: NullableMetricSchema,
});

export const TakeoutActivityItemSchema = TakeoutActivityMetadataSchema.extend({ kind: z.literal('activity') });
export const TakeoutImportScanSchema = z.object({
  items: z.array(z.discriminatedUnion('kind', [TakeoutActivityItemSchema, TakeoutManualItemSchema])).max(100_000),
});
export type TakeoutImportScanDto = z.output<typeof TakeoutImportScanSchema>;
export type TakeoutActivityMetadataDto = z.output<typeof TakeoutActivityMetadataSchema>;
export type TakeoutManualItemDto = z.output<typeof TakeoutManualItemSchema>;

export const TakeoutImportScanResponseSchema = z.object({ pendingItemKeys: z.array(z.string()) });
export const TakeoutItemSubmissionResponseSchema = z.object({ accepted: z.boolean() });
export const TakeoutItemFailureSchema = z.object({
  itemKey: z.string().min(1).max(1024),
  error: z.string().min(1).max(4096),
});
export const TakeoutFinalizeSchema = z.object({
  extractionErrors: z.number().int().nonnegative().max(100_000).default(0),
});

export const TakeoutImportStatusSchema = z.object({
  importId: z.string().uuid(),
  status: z.enum(['scanning', 'uploading', 'processing', 'completed', 'failed', 'cancelled']),
  total: z.number().int().nonnegative().nullable(),
  uploaded: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  duplicates: z.number().int().nonnegative(),
  error: z.string().nullable(),
});
export type TakeoutImportStatusDto = z.output<typeof TakeoutImportStatusSchema>;
