import { createZodDto } from 'nestjs-zod';
import z from 'zod';

import { ACTIVITY_TYPES } from 'src/domain/activity-type';
import { RUNNING_BEST_EFFORTS } from 'src/domain/running-best-effort';

export const ActivityTypeSchema = z.enum(ACTIVITY_TYPES).describe('Activity sport type');
const RunningBestEffortTypeSchema = z.enum(RUNNING_BEST_EFFORTS.map(({ type }) => type));

export const ActivityIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Activity id'),
  })
  .meta({ id: 'ActivityIdParamDto' });

export const ActivityListQuerySchema = z
  .object({
    cursor: z.string().min(1).optional().describe('Opaque cursor returned by the previous page'),
    limit: z.coerce.number().int().min(1).max(100).default(50).describe('Maximum activities to return'),
  })
  .meta({ id: 'ActivityListQueryDto' });

export const ActivitySchema = z
  .object({
    id: z.string().uuid().describe('Activity id'),
    uploadId: z.string().uuid().describe('Source upload id'),
    sport: ActivityTypeSchema,
    name: z.string().nullable().describe('Activity name'),
    description: z.string().nullable().describe('Activity description'),
    startedAt: z.string().datetime().describe('Start time in ISO-8601 format'),
    timezoneOffsetMinutes: z.number().int().nullable().describe('Minutes east of UTC'),
    elapsedTime: z.number().int().describe('Elapsed duration in seconds'),
    movingTime: z.number().int().nullable().describe('Moving duration in seconds'),
    distance: z.number().nullable().describe('Distance in meters'),
    elevationGain: z.number().nullable().describe('Total elevation gain in meters'),
    elevationLoss: z.number().nullable().describe('Total elevation loss in meters'),
    avgSpeed: z.number().nullable().describe('Average speed in meters per second'),
    maxSpeed: z.number().nullable().describe('Peak speed in meters per second'),
    avgHr: z.number().int().nullable().describe('Average heart rate in bpm'),
    maxHr: z.number().int().nullable().describe('Maximum heart rate in bpm'),
    avgCadence: z.number().int().nullable().describe('Average cadence in rpm'),
    maxCadence: z.number().int().nullable().describe('Maximum cadence in rpm'),
    avgPower: z.number().int().nullable().describe('Average power in watts'),
    maxPower: z.number().int().nullable().describe('Maximum power in watts'),
    normalizedPower: z.number().int().nullable().describe('Normalized power in watts'),
    calories: z.number().int().nullable().describe('Calories in kcal'),
    createdAt: z.string().datetime().describe('Creation timestamp in ISO-8601 format'),
    updatedAt: z.string().datetime().describe('Last update timestamp in ISO-8601 format'),
  })
  .meta({ id: 'ActivityDto' });

export const ActivityListResponseSchema = z
  .object({
    activities: z.array(ActivitySchema),
    nextCursor: z.string().nullable().describe('Cursor for the next page, or null at the end'),
    total: z.number().int().nonnegative().describe('Total number of activities'),
  })
  .meta({ id: 'ActivityListResponseDto' });

export const ActivityDetailSchema = ActivitySchema.extend({
  track: z
    .object({
      type: z.literal('LineString'),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
    })
    .nullable()
    .describe('GPS route as GeoJSON'),
  bestEfforts: z.array(
    z.object({
      type: RunningBestEffortTypeSchema,
      label: z.string(),
      distance: z.number().positive().describe('Standard effort distance in meters'),
      elapsedTime: z.number().positive().describe('Effort duration in seconds'),
      startTime: z.number().nonnegative().describe('Start offset from activity start in seconds'),
      endTime: z.number().positive().describe('End offset from activity start in seconds'),
    }),
  ),
}).meta({ id: 'ActivityDetailDto' });

export const ActivityUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).nullable().optional().describe('Display name for the activity'),
    description: z.string().trim().max(10_000).nullable().optional().describe('Description for the activity'),
    sport: ActivityTypeSchema.optional(),
    startedAt: z.string().datetime().optional().describe('Updated start time in ISO-8601 format'),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .meta({ id: 'ActivityUpdateDto' });

export class ActivityIdParamDto extends createZodDto(ActivityIdParamSchema) {}
export class ActivityListQueryDto extends createZodDto(ActivityListQuerySchema) {}
export class ActivityDto extends createZodDto(ActivitySchema) {}
export class ActivityDetailDto extends createZodDto(ActivityDetailSchema) {}
export class ActivityListResponseDto extends createZodDto(ActivityListResponseSchema) {}
export class ActivityUpdateDto extends createZodDto(ActivityUpdateSchema) {}
