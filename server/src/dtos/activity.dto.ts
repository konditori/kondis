import { createZodDto } from 'nestjs-zod';
import z from 'zod';

export const ActivityIdParamSchema = z
  .object({
    id: z.string().uuid().describe('Activity id'),
  })
  .meta({ id: 'ActivityIdParamDto' });

export const ActivitySchema = z
  .object({
    id: z.string().uuid().describe('Activity id'),
    uploadId: z.string().uuid().describe('Source upload id'),
    sport: z.string().describe('Primary sport type'),
    subSport: z.string().nullable().describe('Secondary sport type'),
    name: z.string().nullable().describe('Activity name'),
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
  })
  .meta({ id: 'ActivityListResponseDto' });

export const ActivityDetailSchema = ActivitySchema.extend({
  track: z
    .object({
      type: z.literal('LineString'),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
    })
    .nullable()
    .describe('Simplified GPS route as GeoJSON'),
}).meta({ id: 'ActivityDetailDto' });

export const ActivityUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).nullable().optional().describe('Display name for the activity'),
    sport: z.string().trim().min(1).max(100).optional().describe('Primary sport type'),
    subSport: z.string().trim().min(1).max(100).nullable().optional().describe('Secondary sport type'),
    startedAt: z.string().datetime().optional().describe('Updated start time in ISO-8601 format'),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .meta({ id: 'ActivityUpdateDto' });

export class ActivityIdParamDto extends createZodDto(ActivityIdParamSchema) {}
export class ActivityDto extends createZodDto(ActivitySchema) {}
export class ActivityDetailDto extends createZodDto(ActivityDetailSchema) {}
export class ActivityListResponseDto extends createZodDto(ActivityListResponseSchema) {}
export class ActivityUpdateDto extends createZodDto(ActivityUpdateSchema) {}
