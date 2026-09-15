import { sql, type RawBuilder } from 'kysely';
import { ActivityType } from 'src/enum';
import { NotFoundException } from 'src/errors';
import { requireScope, timezoneSchema, type Principal } from 'src/mcp/context';
import type { KondisDatabase } from 'src/types';
import { z } from 'zod';

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
  limit: z.number().int().min(1).max(100).default(25),
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

type ActivitySummary = {
  id: string;
  name: string | null;
  description: string | null;
  sport: string;
  tags: string[];
  startedAt: Date;
  revision: number;
  metricsStatus: string;
  bestEffortsStatus: string;
  routeMatchesStatus: string;
  elapsedTime: number | null;
  movingTime: number | null;
  distance: number | null;
  elevationGain: number | null;
  avgSpeed: number | null;
  avgHr: number | null;
  avgPower: number | null;
};
const projection = sql`a.id, a.name, a.description, a.sport, a.tags, a.started_at AS "startedAt", a.revision,
  CASE WHEN a.metrics_computed_at IS NULL THEN 'pending' ELSE 'completed' END AS "metricsStatus",
  CASE WHEN a.best_efforts_computed_at IS NULL THEN 'pending' ELSE 'completed' END AS "bestEffortsStatus",
  CASE WHEN a.route_matches_computed_at IS NULL THEN 'pending' ELSE 'completed' END AS "routeMatchesStatus",
  m.elapsed_time AS "elapsedTime", m.moving_time AS "movingTime", m.distance, m.elevation_gain AS "elevationGain",
  m.avg_speed AS "avgSpeed", m.avg_hr AS "avgHr", m.avg_power AS "avgPower"`;

export class ActivityQueryService {
  constructor(private readonly db: KondisDatabase) {}

  private async query<T>(query: RawBuilder<T>): Promise<T[]> {
    return this.db.transaction().execute(async (trx) => {
      await sql`SET LOCAL statement_timeout = '5s'`.execute(trx);
      const result = await query.execute(trx);
      return result.rows;
    });
  }

  async context(principal: Principal) {
    requireScope(principal, 'profile:read');
    const rows = await this.query(
      sql`SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", COALESCE(p.timezone, 'UTC') AS timezone, COALESCE(p.units, 'metric') AS units FROM "user" u LEFT JOIN mcp_preference p ON p.user_id = u.id WHERE u.id = ${principal.userId}`,
    );
    return { athlete: rows[0], sports: Object.values(ActivityType), scopes: [...principal.scopes], units: UNITS };
  }

  async search(principal: Principal, input: z.infer<typeof SearchSchema>) {
    requireScope(principal, 'activities:read');
    const v = SearchSchema.parse(input);
    const filters = [sql`a.user_id = ${principal.userId}`];
    if (v.from) {
      filters.push(sql`a.started_at >= ${v.from}::timestamptz`);
    }
    if (v.to) {
      filters.push(sql`a.started_at < ${v.to}::timestamptz`);
    }
    if (v.sport) {
      filters.push(sql`a.sport = ${v.sport}`);
    }
    if (v.search) {
      filters.push(sql`(a.name ILIKE ${`%${v.search}%`} OR a.description ILIKE ${`%${v.search}%`})`);
    }
    if (v.tags?.length) {
      filters.push(sql`a.tags @> ${v.tags}::text[]`);
    }
    if (v.minDistance !== undefined) {
      filters.push(sql`m.distance >= ${v.minDistance}`);
    }
    if (v.maxDistance !== undefined) {
      filters.push(sql`m.distance <= ${v.maxDistance}`);
    }
    if (v.minDuration !== undefined) {
      filters.push(sql`m.elapsed_time >= ${v.minDuration}`);
    }
    if (v.maxDuration !== undefined) {
      filters.push(sql`m.elapsed_time <= ${v.maxDuration}`);
    }
    if (v.cursor) {
      const cursor = z.object({ at: z.string().datetime(), id: z.string().uuid() }).parse(JSON.parse(atob(v.cursor)));
      filters.push(sql`(a.started_at, a.id) < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`);
    }
    const rows = await this.query(
      sql<ActivitySummary>`SELECT ${projection} FROM activity a LEFT JOIN activity_metric m ON m.activity_id = a.id WHERE ${sql.join(filters, sql` AND `)} ORDER BY a.started_at DESC, a.id DESC LIMIT ${v.limit + 1}`,
    );
    const items = rows.slice(0, v.limit);
    const last = items.at(-1);
    return {
      activities: items,
      nextCursor:
        rows.length > v.limit && last
          ? btoa(JSON.stringify({ at: new Date(last.startedAt).toISOString(), id: last.id }))
          : null,
      units: UNITS,
    };
  }

  async get(principal: Principal, id: string) {
    requireScope(principal, 'activities:read');
    const rows = await this.query(
      sql<ActivitySummary>`SELECT ${projection} FROM activity a LEFT JOIN activity_metric m ON m.activity_id = a.id WHERE a.id = ${id}::uuid AND a.user_id = ${principal.userId}`,
    );
    if (!rows[0]) {
      throw new NotFoundException('Activity does not exist');
    }
    return rows[0];
  }

  async detail(principal: Principal, id: string) {
    const activity = await this.get(principal, id);
    const laps = await this.query(
      sql`SELECT l.lap_index AS "lapIndex", l.started_at AS "startedAt", l.elapsed_time AS "elapsedTime", l.distance, l.avg_hr AS "avgHr", l.avg_power AS "avgPower" FROM lap l JOIN activity a ON a.id = l.activity_id WHERE a.id = ${id}::uuid AND a.user_id = ${principal.userId} ORDER BY l.lap_index LIMIT 200`,
    );
    return { ...activity, laps, lapLimit: 200, units: UNITS };
  }

  async streams(
    principal: Principal,
    input: { id: string; types: string[]; from: number; to?: number; maxPoints: number },
  ) {
    requireScope(principal, 'activities:read');
    if (input.types.some((type) => ['latitude', 'longitude'].includes(type))) {
      requireScope(principal, 'location:read');
    }
    await this.get(principal, input.id);
    // Expand only the time array; sample aligned indices in SQL before returning data.
    return this.query(sql`
      WITH times AS (
        SELECT t.ordinality::int AS i, t.value, row_number() OVER (ORDER BY t.ordinality) AS n, count(*) OVER () AS total
        FROM activity_stream s JOIN activity a ON a.id = s.activity_id,
          unnest(s.data) WITH ORDINALITY AS t(value, ordinality)
        WHERE a.id = ${input.id}::uuid AND a.user_id = ${principal.userId} AND s.type = 'time'
          AND t.value >= ${input.from} AND (${input.to ?? null}::double precision IS NULL OR t.value <= ${input.to ?? null})
      ), sampled AS (
        SELECT * FROM times WHERE (n - 1) % greatest(1, ceil(total::numeric / ${input.maxPoints})::bigint) = 0
      )
      SELECT s.type, array_agg(s.data[t.i] ORDER BY t.i) AS values, array_agg(t.value ORDER BY t.i) AS times,
        max(t.total)::int AS "originalPointCount", 'uniform-index' AS downsampling
      FROM sampled t JOIN activity_stream s ON s.activity_id = ${input.id}::uuid
      WHERE s.type = ANY(${input.types}::text[]) GROUP BY s.type ORDER BY s.type
    `);
  }

  async summarize(principal: Principal, input: z.infer<typeof SummarySchema>) {
    requireScope(principal, 'activities:read');
    const v = SummarySchema.parse(input);
    const rows = await this.query(sql`
      SELECT date_trunc(${v.period}, a.started_at AT TIME ZONE ${v.timezone})::text AS period,
        count(*)::int AS "activityCount", count(m.activity_id)::int AS "activitiesWithMetrics",
        count(m.distance)::int AS "activitiesWithDistance", count(m.avg_hr)::int AS "activitiesWithHeartRate",
        count(m.avg_power)::int AS "activitiesWithPower",
        sum(m.distance) AS distance, sum(m.elapsed_time)::float8 AS "elapsedTime", sum(m.elevation_gain) AS "elevationGain",
        (sum(m.avg_hr * m.elapsed_time::float8) / nullif(sum(m.elapsed_time) FILTER (WHERE m.avg_hr IS NOT NULL), 0)) AS "weightedHeartRate",
        (sum(m.avg_power * m.elapsed_time::float8) / nullif(sum(m.elapsed_time) FILTER (WHERE m.avg_power IS NOT NULL), 0)) AS "weightedPower",
        (array_agg(a.id ORDER BY a.started_at DESC, a.id DESC))[1:20] AS "sampleActivityIds"
      FROM activity a LEFT JOIN activity_metric m ON m.activity_id = a.id AND a.metrics_computed_at IS NOT NULL
      WHERE a.user_id = ${principal.userId} AND a.started_at >= ${v.from}::timestamptz AND a.started_at < ${v.to}::timestamptz
        AND (${v.sport ?? null}::text IS NULL OR a.sport = ${v.sport ?? null})
      GROUP BY 1 ORDER BY 1
    `);
    return {
      periods: rows,
      range: v,
      definitions: METRIC_DEFINITIONS,
      note: 'Periods without recorded activities are omitted. Source IDs are a sample; use search_activities for the full set.',
    };
  }

  async compare(principal: Principal, ids: string[]) {
    const activities = [];
    for (const id of ids) {
      activities.push(await this.get(principal, id));
    }
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
    const activity = await this.get(principal, id);
    const matches = await this.query(
      sql<ActivitySummary>`SELECT ${projection} FROM activity_route_match r JOIN activity a ON a.id = r.matched_activity_id LEFT JOIN activity_metric m ON m.activity_id = a.id WHERE r.activity_id = ${id}::uuid AND a.user_id = ${principal.userId} ORDER BY a.started_at DESC, a.id DESC LIMIT ${limit}`,
    );
    return { activity, matches, limit, units: UNITS };
  }

  async bestEfforts(principal: Principal, input: { type: string; sport?: ActivityType; year?: number; limit: number }) {
    requireScope(principal, 'activities:read');
    return this.query(sql`
      SELECT e.activity_id AS "activityId", a.name, a.sport, a.started_at AS "startedAt", e.type, e.value, e.value_kind AS "valueKind", e.elapsed_time AS "elapsedTime", e.distance, e.overall_rank AS "overallRank", e.year_rank AS "yearRank", e.year
      FROM activity_best_effort e JOIN activity a ON a.id = e.activity_id
      WHERE a.user_id = ${principal.userId} AND e.type = ${input.type} AND NOT a.exclude_from_rankings
        AND (${input.sport ?? null}::text IS NULL OR a.sport = ${input.sport ?? null})
        AND (${input.year ?? null}::int IS NULL OR e.year = ${input.year ?? null})
      ORDER BY e.overall_rank, a.started_at DESC, a.id LIMIT ${input.limit}
    `);
  }
}
