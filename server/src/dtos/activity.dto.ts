import { createZodDto } from 'nestjs-zod';
import z from 'zod';

import { ActivityImageSchema } from 'src/dtos/activity-image.dto';
import { SocialUserSchema } from 'src/dtos/social.dto';
import { ACTIVITY_TAG_IDS, ACTIVITY_TYPE_IDS, BEST_EFFORT_TYPES } from 'src/constants';
import { AverageMetric, BestEffortGroup } from 'src/types';

export const ActivityTypeSchema = z
  .enum(ACTIVITY_TYPE_IDS)
  .describe('Activity sport type')
  .meta({ id: 'ActivityType' });
export const ActivityTypeSettingsSchema = z
  .object({
    type: ActivityTypeSchema,
    averageMetric: z.enum(AverageMetric),
    showAveragePower: z.boolean(),
    bestEffortGroup: z.enum(BestEffortGroup),
  })
  .meta({ id: 'ActivityTypeSettings' });
export const ActivityTypeListResponseSchema = z.array(ActivityTypeSettingsSchema);
export const ActivityTagSchema = z.enum(ACTIVITY_TAG_IDS).meta({ id: 'ActivityTag' });
const BestEffortTypeSchema = z.enum(BEST_EFFORT_TYPES).meta({ id: 'BestEffortType' });
const BestEffortValueKindSchema = z
  .enum(['duration', 'distance', 'elevation', 'power'])
  .meta({ id: 'BestEffortValueKind' });
const BestEffortSportSchema = z.enum(['run', 'ride']).meta({ id: 'BestEffortSport' });

export const BestEffortListParamSchema = z.object({
  sport: BestEffortSportSchema.describe('Best effort sport category'),
  type: BestEffortTypeSchema.describe('Best effort type'),
});

export const ActivityIdParamSchema = z.object({
  id: z.string().uuid().describe('Activity id'),
});

export const ActivityListQuerySchema = z.object({
  cursor: z.string().min(1).optional().describe('Opaque cursor returned by the previous page'),
  limit: z.coerce.number().int().min(1).max(100).default(50).describe('Maximum activities to return'),
  search: z.string().trim().max(200).optional().describe('Text to search in activity name, description, or sport'),
  tags: z.string().trim().optional().describe('Comma-separated activity tags to include'),
  tagMatch: z.enum(['any', 'all']).default('any').describe('Whether any or all requested tags must match'),
});

export const ActivityMetricSchema = z
  .object({
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
  })
  .meta({ id: 'ActivityMetricDto' });

export const ActivitySchema = z.object({
  id: z.string().uuid().describe('Activity id'),
  uploadId: z.string().uuid().describe('Source upload id'),
  uploadFileName: z.string().optional().describe('Original uploaded activity filename'),
  userId: z.string().uuid().nullable().optional().describe('Activity owner id'),
  athlete: SocialUserSchema.optional(),
  likeCount: z.number().int().nonnegative().optional(),
  commentCount: z.number().int().nonnegative().optional(),
  viewerLiked: z.boolean().optional(),
  sport: ActivityTypeSchema,
  name: z.string().nullable().describe('Activity name'),
  description: z.string().nullable().describe('Activity description'),
  excludeFromRankings: z.boolean().describe('Exclude from rankings'),
  tags: z.array(ActivityTagSchema).describe('Activity tags'),
  startedAt: z.string().datetime().describe('Start time in ISO-8601 format'),
  timezoneOffsetMinutes: z.number().int().nullable().describe('Minutes east of UTC'),
  metrics: ActivityMetricSchema.nullable().describe('Derived metrics, or null while computation is pending'),
  createdAt: z.string().datetime().describe('Creation timestamp in ISO-8601 format'),
  updatedAt: z.string().datetime().describe('Last update timestamp in ISO-8601 format'),
});

const ActivityTrackSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
});

const ActivitySplitSchema = z.object({
  distance: z.number().positive().describe('Split distance in meters'),
  elapsedTime: z.number().positive().describe('Split duration in seconds'),
  startTime: z.number().nonnegative().describe('Start offset from activity start in seconds'),
  endTime: z.number().positive().describe('End offset from activity start in seconds'),
  avgHr: z.number().int().positive().nullable().describe('Average heart rate during the split'),
  elevationChange: z.number().nullable().describe('Net elevation change during the split in meters'),
});

const ActivityAnalysisSchema = z.object({
  splits: z.array(ActivitySplitSchema).describe('Consecutive kilometre splits'),
  profile: z
    .array(
      z.object({
        distance: z.number().nonnegative(),
        time: z.number().nonnegative(),
        altitude: z.number(),
        heartRate: z.number().int().positive().nullable(),
      }),
    )
    .describe('Downsampled elevation profile points'),
  route: z
    .array(
      z.object({
        time: z.number().nonnegative(),
        coordinate: z.tuple([z.number(), z.number()]),
      }),
    )
    .describe('Downsampled route points aligned to elapsed time'),
});

export const ActivityListResponseSchema = z.object({
  activities: z.array(
    ActivitySchema.extend({
      topBestEfforts: z
        .array(
          z.object({
            type: BestEffortTypeSchema,
            value: z.number().nonnegative().describe('Best-effort value; watts for power efforts'),
            overallRank: z.number().int().min(1),
            yearRank: z.number().int().min(1).max(3),
          }),
        )
        .max(3)
        .nullable(),
      achievementCount: z.number().int().nonnegative().nullable(),
      track: ActivityTrackSchema.nullable().describe('Simplified GPS route as GeoJSON'),
      images: z.array(ActivityImageSchema),
    }),
  ),
  nextCursor: z.string().nullable().describe('Cursor for the next page, or null at the end'),
  total: z.number().int().nonnegative().describe('Total number of activities'),
});

export const BestEffortListResponseSchema = z.object({
  sport: BestEffortSportSchema,
  type: BestEffortTypeSchema,
  valueKind: BestEffortValueKindSchema,
  higherIsBetter: z.boolean(),
  distance: z.number().positive().nullable().describe('Selected distance in meters, when applicable'),
  duration: z.number().positive().nullable().describe('Selected duration in seconds, when applicable'),
  options: z.array(
    z.object({
      type: BestEffortTypeSchema,
      valueKind: BestEffortValueKindSchema,
    }),
  ),
  efforts: z.array(
    z.object({
      activityId: z.string().uuid(),
      activityName: z.string().nullable(),
      sport: ActivityTypeSchema,
      startedAt: z.string().datetime(),
      elapsedTime: z.number().positive(),
      value: z.number().positive(),
      overallRank: z.number().int().positive(),
      year: z.number().int(),
      yearRank: z.number().int().positive(),
    }),
  ),
});

export const ActivityDetailSchema = ActivitySchema.extend({
  images: z.array(ActivityImageSchema),
  track: ActivityTrackSchema.nullable().describe('GPS route as GeoJSON'),
  analysis: ActivityAnalysisSchema.nullable().describe('Split, profile, and route data for activity analysis'),
  bestEfforts: z
    .array(
      z.object({
        type: BestEffortTypeSchema,
        value: z.number().nonnegative().describe('Best-effort value; watts for power efforts'),
        distance: z.number().positive().describe('Standard effort distance in meters'),
        elapsedTime: z.number().positive().describe('Effort duration in seconds'),
        startTime: z.number().nonnegative().describe('Start offset from activity start in seconds'),
        endTime: z.number().positive().describe('End offset from activity start in seconds'),
        avgHr: z.number().int().positive().nullable().describe('Average heart rate during the effort'),
        elevationChange: z.number().nullable().describe('Net elevation change during the effort in meters'),
        overallRank: z.number().int().positive().describe('Rank among all matching efforts'),
        year: z.number().int().describe('Local calendar year of the activity'),
        yearRank: z.number().int().positive().describe('Rank among matching efforts in that calendar year'),
      }),
    )
    .nullable(),
  matchedRouteCount: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .describe('Activities matched to the same GPS route, or null while matching is pending'),
});

export const MatchedRouteListResponseSchema = z.object({
  sourceActivityId: z.string().uuid(),
  activities: z.array(ActivitySchema).nullable(),
});

export const ActivityUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).nullable().optional().describe('Display name for the activity'),
    description: z.string().trim().max(10_000).nullable().optional().describe('Description for the activity'),
    excludeFromRankings: z.boolean().optional().describe('Exclude from rankings'),
    tags: z.array(ActivityTagSchema).optional().describe('Replace the activity tags'),
    sport: ActivityTypeSchema.optional(),
    startedAt: z.string().datetime().optional().describe('Updated start time in ISO-8601 format'),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export class ActivityIdParamDto extends createZodDto(ActivityIdParamSchema) {}
export class ActivityListQueryDto extends createZodDto(ActivityListQuerySchema) {}
export class ActivityDto extends createZodDto(ActivitySchema) {}
export class ActivityDetailDto extends createZodDto(ActivityDetailSchema) {}
export class MatchedRouteListResponseDto extends createZodDto(MatchedRouteListResponseSchema) {}
export class ActivityListResponseDto extends createZodDto(ActivityListResponseSchema) {}
export class ActivityTypeListResponseDto extends createZodDto(ActivityTypeListResponseSchema) {}
export class ActivityTagListResponseDto extends createZodDto(
  z.array(
    z.object({
      tag: ActivityTagSchema,
      label: z.string(),
      sports: z.union([z.literal('all'), z.array(ActivityTypeSchema)]),
    }),
  ),
) {}
export class BestEffortListParamDto extends createZodDto(BestEffortListParamSchema) {}
export class BestEffortListResponseDto extends createZodDto(BestEffortListResponseSchema) {}
export class ActivityUpdateDto extends createZodDto(ActivityUpdateSchema) {}
