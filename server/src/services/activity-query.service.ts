import { BEST_EFFORT_TYPES } from 'src/constants';
import { ActivityType, StreamType, UnitSystem } from 'src/enum';
import { BadRequestException, NotFoundException } from 'src/errors';
import { requireScope, timezoneSchema, type Principal } from 'src/mcp/context';
import { BaseService } from 'src/services/base.service';
import type { ActivityRecord } from 'src/types';
import { z } from 'zod';

const idSchema = z.string().uuid();
const limitSchema = z.number().int().min(1).max(100).default(25);
const cursorSchema = z.object({ at: z.string().datetime(), id: idSchema });

export const SearchSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sport: z.enum(ActivityType).optional(),
  search: z.string().max(200).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  minDistance: z.number().nonnegative().optional(),
  maxDistance: z.number().nonnegative().optional(),
  minDuration: z.number().nonnegative().optional(),
  maxDuration: z.number().nonnegative().optional(),
  cursor: z.string().max(500).optional(),
  limit: limitSchema,
});
export const SummarySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    timezone: timezoneSchema.default('UTC'),
    period: z.enum(['week', 'month']).default('week'),
    sport: z.enum(ActivityType).optional(),
  })
  .refine(
    (v) => Date.parse(v.to) > Date.parse(v.from) && Date.parse(v.to) - Date.parse(v.from) <= 366 * 5 * 86_400_000,
    'Use a positive range of at most five years',
  );

export const StreamsSchema = z
  .object({
    id: idSchema,
    types: z.array(z.enum(StreamType)).min(1).max(10),
    from: z.number().nonnegative().default(0),
    to: z.number().nonnegative().optional(),
    maxPoints: z.number().int().min(2).max(1000).default(250),
  })
  .refine((v) => v.to === undefined || v.to >= v.from, 'Stream end must not precede start');

export const BestEffortsSchema = z.object({
  type: z.enum(BEST_EFFORT_TYPES),
  sport: z.enum(ActivityType).optional(),
  year: z.number().int().min(1900).max(3000).optional(),
  limit: limitSchema,
});

export const UNITS = {
  distance: 'm',
  elapsedTime: 's',
  movingTime: 's',
  elevationGain: 'm',
  avgSpeed: 'm/s',
  avgHr: 'bpm',
  avgPower: 'W',
};
export const METRIC_DEFINITIONS = {
  units: UNITS,
  calculationVersion: '1',
  missing: 'null means not recorded; pending means processing has not finished',
  training:
    'Volume uses recorded distance and elapsed duration. Heart rate and power are duration-weighted over activities with those measurements. These are descriptive intensity measures, not individualized training zones.',
  periods: 'Local calendar periods; weeks begin Monday. from is inclusive and to is exclusive.',
};

const activitySummary = (activity: ActivityRecord) => ({
  id: activity.id,
  name: activity.name,
  description: activity.description,
  sport: activity.sport,
  tags: activity.tags,
  startedAt: new Date(activity.started_at),
  revision: activity.revision,
  metricsStatus: activity.metrics_computed_at === null ? 'pending' : 'completed',
  bestEffortsStatus: activity.best_efforts_computed_at === null ? 'pending' : 'completed',
  routeMatchesStatus: activity.route_matches_computed_at === null ? 'pending' : 'completed',
  elapsedTime: activity.metrics?.elapsed_time ?? null,
  movingTime: activity.metrics?.moving_time ?? null,
  distance: activity.metrics?.distance ?? null,
  elevationGain: activity.metrics?.elevation_gain ?? null,
  avgSpeed: activity.metrics?.avg_speed ?? null,
  avgHr: activity.metrics?.avg_hr ?? null,
  avgPower: activity.metrics?.avg_power ?? null,
});

const decodeCursor = (value: string) => {
  try {
    const cursor = cursorSchema.parse(JSON.parse(atob(value)));
    return { startedAt: new Date(cursor.at), id: cursor.id };
  } catch {
    throw new BadRequestException('Invalid activity cursor');
  }
};

export class ActivityQueryService extends BaseService {
  async context(principal: Principal) {
    requireScope(principal, 'profile:read');
    const [user, preference] = await Promise.all([
      this.userRepository.findById(principal.userId),
      this.mcpPreferenceRepository.findByUserId(principal.userId),
    ]);
    if (!user) {
      throw new NotFoundException('Athlete does not exist');
    }
    return {
      athlete: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        timezone: preference?.timezone ?? 'UTC',
        units: preference?.units ?? UnitSystem.Metric,
      },
      sports: Object.values(ActivityType),
      scopes: [...principal.scopes],
      units: UNITS,
    };
  }

  async search(principal: Principal, input: z.input<typeof SearchSchema>) {
    requireScope(principal, 'activities:read');
    const v = SearchSchema.parse(input);
    const rows = await this.activityRepository.listRecentPage({
      ...v,
      limit: v.limit + 1,
      userId: principal.userId,
      from: v.from ? new Date(v.from) : undefined,
      to: v.to ? new Date(v.to) : undefined,
      searchFields: 'name-description',
      includeTrack: false,
      tagMatch: 'all',
      cursor: v.cursor === undefined ? undefined : decodeCursor(v.cursor),
    });
    const items = rows.slice(0, v.limit).map((activity) => activitySummary(activity));
    const last = items.at(-1);
    return {
      activities: items,
      nextCursor:
        rows.length > v.limit && last ? btoa(JSON.stringify({ at: last.startedAt.toISOString(), id: last.id })) : null,
      units: UNITS,
    };
  }

  async get(principal: Principal, id: string) {
    requireScope(principal, 'activities:read');
    const activity = await this.activityRepository.getById(idSchema.parse(id), principal.userId);
    if (!activity) {
      throw new NotFoundException('Activity does not exist');
    }
    return activitySummary(activity);
  }

  async detail(principal: Principal, id: string) {
    const activity = await this.get(principal, id);
    const laps = await this.activityRepository.getLaps(id, principal.userId, 200);
    return {
      ...activity,
      laps: laps.map((lap) => ({
        lapIndex: lap.lap_index,
        startedAt: lap.started_at,
        elapsedTime: lap.elapsed_time,
        distance: lap.distance,
        avgHr: lap.avg_hr,
        avgPower: lap.avg_power,
      })),
      lapLimit: 200,
      units: UNITS,
    };
  }

  async streams(
    principal: Principal,
    input: { id: string; types: string[]; from?: number; to?: number; maxPoints?: number },
  ) {
    requireScope(principal, 'activities:read');
    const v = StreamsSchema.parse(input);
    if (v.types.some((type) => type === StreamType.Latitude || type === StreamType.Longitude)) {
      requireScope(principal, 'location:read');
    }
    await this.get(principal, v.id);
    return this.activityRepository.getSampledStreams({ ...v, userId: principal.userId });
  }

  async summarize(principal: Principal, input: z.input<typeof SummarySchema>) {
    requireScope(principal, 'activities:read');
    const v = SummarySchema.parse(input);
    const periods = await this.activityRepository.summarize({
      ...v,
      userId: principal.userId,
      from: new Date(v.from),
      to: new Date(v.to),
    });
    return {
      periods,
      range: v,
      definitions: METRIC_DEFINITIONS,
      note: 'Periods without recorded activities are omitted. Source IDs are a sample; use search_activities for the full set.',
    };
  }

  async compare(principal: Principal, ids: string[]) {
    requireScope(principal, 'activities:read');
    const validatedIds = z.array(idSchema).min(2).max(10).parse(ids);
    const activities = await Promise.all(validatedIds.map((id) => this.get(principal, id)));
    const baseline = activities[0];
    const metrics = ['distance', 'elapsedTime', 'elevationGain', 'avgSpeed', 'avgHr', 'avgPower'] as const;
    return {
      baselineId: baseline.id,
      activities,
      differences: activities.slice(1).map((a) => ({
        id: a.id,
        ...Object.fromEntries(
          metrics.map((key) => [key, a[key] === null || baseline[key] === null ? null : a[key] - baseline[key]]),
        ),
      })),
      units: UNITS,
      limitations: 'Differences are descriptive. Route, weather, sensor coverage, and effort can affect comparability.',
    };
  }

  async routes(principal: Principal, id: string, limit: number) {
    requireScope(principal, 'activities:read');
    limit = limitSchema.parse(limit);
    const activity = await this.get(principal, id);
    const matches = await this.activityRepository.listMatchedRoutes(id, principal.userId, { limit, order: 'desc' });
    return { activity, matches: matches.map((match) => activitySummary(match)), limit, units: UNITS };
  }

  async bestEfforts(
    principal: Principal,
    input: { type: string; sport?: ActivityType; year?: number; limit?: number },
  ) {
    requireScope(principal, 'activities:read');
    const v = BestEffortsSchema.parse(input);
    const efforts = await this.activityRepository.listBestEfforts(
      v.type,
      v.sport ? [v.sport] : Object.values(ActivityType),
      principal.userId,
      { year: v.year, limit: v.limit, order: 'rank' },
    );
    return efforts.map((effort) => ({
      activityId: effort.activity_id,
      name: effort.name,
      sport: effort.sport,
      startedAt: effort.started_at,
      type: v.type,
      value: effort.value,
      valueKind: effort.value_kind,
      elapsedTime: effort.elapsed_time,
      distance: effort.distance,
      overallRank: effort.overall_rank,
      yearRank: effort.year_rank,
      year: effort.year,
    }));
  }
}
