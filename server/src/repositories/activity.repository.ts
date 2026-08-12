import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

import { KondisDatabase, KondisExecutor, KYSELY } from 'src/db/database';
import {
  Activity,
  ActivityMetric,
  ActivityStream,
  ActivityUpdate,
  NewActivity,
  NewLap,
  StreamType,
} from 'src/db/schema';
import { getColumns } from 'src/schema/decorators';
import { ActivityMetricTable } from 'src/schema/tables/activity-metric.table';
import { ActivityTable } from 'src/schema/tables/activity.table';
import { ActivityType, BestEffortGroup, BestEffortType } from 'src/types';
import { getActivityTypeSettings } from 'src/utils/activity';
import {
  computeBiggestClimb,
  computeCyclingBestEfforts,
  computeCyclingPowerBestEfforts,
  computeCyclingSummaryBestEfforts,
  computeRunningBestEfforts,
} from 'src/utils/best-effort';

// TODO: should we move these values somewhere else than the repo?
const TRACK_SIMPLIFY_TOLERANCE_DEG = 0.00002;
const ROUTE_CANDIDATE_LIMIT = 250;
const ROUTE_PREFILTER_RADIUS_METERS = 250;
const ROUTE_ENDPOINT_TOLERANCE_METERS = 120;
const ROUTE_MIN_LENGTH_RATIO = 0.88;
const ROUTE_MAX_LENGTH_RATIO = 1.14;
const ROUTE_FRECHET_TOLERANCE_METERS = 200;

// Heavy geo/vector columns fetched separately (e.g. via ST_AsGeoJSON) instead of by default.
const ACTIVITY_EXCLUDED_COLUMNS = new Set<keyof Activity>(['track', 'detail_track', 'route_embedding']);
type ActivityColumn = Exclude<keyof Activity, 'track' | 'detail_track' | 'route_embedding'>;
const ACTIVITY_COLUMNS = getColumns(ActivityTable)
  .filter((column): column is ActivityColumn => !ACTIVITY_EXCLUDED_COLUMNS.has(column))
  .map((column) => `activity.${column}` as const);

// activity_id is the join key, embedded separately as the parent activity's id.
const METRIC_EXCLUDED_COLUMNS = new Set<keyof ActivityMetric>(['activity_id']);
const METRIC_COLUMNS = getColumns(ActivityMetricTable).filter(
  (column): column is Exclude<keyof ActivityMetric, 'activity_id'> => !METRIC_EXCLUDED_COLUMNS.has(column),
);

export type ActivityStreamInput = { type: StreamType; data: number[] };

export type CreateActivityInput = {
  activity: Omit<NewActivity, 'detail_track' | 'track'>;
  streams: ActivityStreamInput[];
  laps: Omit<NewLap, 'activity_id' | 'id'>[];
};

export type ActivityMetrics = Omit<ActivityMetric, 'activity_id'>;
export type ActivityRecord = Omit<Activity, 'detail_track' | 'route_embedding' | 'track'> & {
  metrics: ActivityMetrics | null;
};

export type UpdateActivityInput = Pick<ActivityUpdate, 'name' | 'description' | 'sport' | 'started_at'>;

export type ActivityCursor = {
  startedAt: Date;
  id: string;
};

type TimedValue = { time: number; value: number };

const timedValues = (time: number[], values: number[], valid: (value: number) => boolean): TimedValue[] => {
  const points: TimedValue[] = [];
  for (let index = 0; index < Math.min(time.length, values.length); index++) {
    const sampleTime = time[index];
    const value = values[index];
    if (
      !Number.isFinite(sampleTime) ||
      !Number.isFinite(value) ||
      !valid(value) ||
      (points.length > 0 && sampleTime <= points.at(-1)!.time)
    ) {
      continue;
    }
    points.push({ time: sampleTime, value });
  }
  return points;
};

const valueAtTime = (points: TimedValue[], targetTime: number): number | null => {
  if (points.length === 0) {
    return null;
  }
  if (targetTime <= points[0].time) {
    return points[0].value;
  }

  for (let index = 1; index < points.length; index++) {
    const after = points[index];
    if (after.time < targetTime) {
      continue;
    }
    const before = points[index - 1];
    const ratio = (targetTime - before.time) / (after.time - before.time);
    return before.value + ratio * (after.value - before.value);
  }
  return points.at(-1)!.value;
};

@Injectable()
export class ActivityRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  private trackCoordinates(streams: ActivityStreamInput[]): [number, number][] {
    const latitude = streams.find((stream) => stream.type === 'latitude')?.data;
    const longitude = streams.find((stream) => stream.type === 'longitude')?.data;
    if (!latitude || !longitude) {
      return [];
    }

    const coordinates: [number, number][] = [];
    const length = Math.min(latitude.length, longitude.length);
    for (let index = 0; index < length; index++) {
      const lat = latitude[index];
      const lon = longitude[index];
      // GeoJSON is [longitude, latitude], not the other way round.
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        coordinates.push([lon, lat]);
      }
    }

    return coordinates;
  }

  private buildTrack(streams: ActivityStreamInput[], simplify: boolean) {
    const coordinates = this.trackCoordinates(streams);
    if (coordinates.length < 2) {
      return null;
    }

    const geojson = JSON.stringify({ type: 'LineString', coordinates });
    if (!simplify) {
      return sql`ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326)::geography`;
    }

    const tolerance = TRACK_SIMPLIFY_TOLERANCE_DEG;
    return sql`ST_Simplify(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326), ${tolerance})::geography`;
  }

  async create(input: CreateActivityInput, executor?: KondisExecutor): Promise<string> {
    if (executor) {
      return this.createWithExecutor(input, executor);
    }
    return this.db.transaction().execute((trx) => this.createWithExecutor(input, trx));
  }

  private async createWithExecutor(input: CreateActivityInput, executor: KondisExecutor): Promise<string> {
    const { id } = await executor
      .insertInto('activity')
      .values({
        ...input.activity,
        track: this.buildTrack(input.streams, true),
        detail_track: this.buildTrack(input.streams, false),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    if (input.streams.length > 0) {
      await executor
        .insertInto('activity_stream')
        .values(input.streams.map((stream) => ({ activity_id: id, type: stream.type, data: stream.data })))
        .execute();
    }

    if (input.laps.length > 0) {
      await executor
        .insertInto('lap')
        .values(
          input.laps.map((lap) => ({
            id: crypto.randomUUID(),
            ...lap,
            activity_id: id,
          })),
        )
        .execute();
    }

    return id;
  }

  getById(id: string) {
    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('activity_metric')
            .select(METRIC_COLUMNS)
            .whereRef('activity_metric.activity_id', '=', 'activity.id'),
        ).as('metrics'),
      )
      .where('activity.id', '=', id)
      .executeTakeFirst();
  }

  getDetailById(id: string) {
    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('activity_metric')
            .select(METRIC_COLUMNS)
            .whereRef('activity_metric.activity_id', '=', 'activity.id'),
        ).as('metrics'),
      )
      .select(sql<string | null>`ST_AsGeoJSON(track)`.as('track_geojson'))
      .select(sql<string | null>`ST_AsGeoJSON(detail_track)`.as('detail_track_geojson'))
      .select((eb) =>
        eb
          .selectFrom('activity_route_match')
          .select(({ fn }) => fn.countAll<number>().as('count'))
          .whereRef('activity_route_match.activity_id', '=', 'activity.id')
          .as('matched_route_count'),
      )
      .where('activity.id', '=', id)
      .executeTakeFirst();
  }

  private async computeMatchingRouteIds(activityId: string, executor: KondisExecutor): Promise<string[]> {
    const { rows } = await sql<{ id: string }>`
      WITH source AS MATERIALIZED (
        SELECT id, sport, track, route_embedding, kondis_normalize_route(track) AS normalized_track
        FROM activity
        WHERE id = ${activityId}::uuid
          AND track IS NOT NULL
          AND route_embedding IS NOT NULL
      ), candidates AS MATERIALIZED (
        SELECT candidate.id
        FROM activity AS candidate
        CROSS JOIN source
        WHERE candidate.sport = source.sport
          AND candidate.track IS NOT NULL
          AND candidate.route_embedding IS NOT NULL
          AND ST_DWithin(candidate.track, source.track, ${ROUTE_PREFILTER_RADIUS_METERS})
        ORDER BY candidate.route_embedding <-> source.route_embedding
        LIMIT ${ROUTE_CANDIDATE_LIMIT}
      )
      SELECT candidate.id
      FROM candidates
      JOIN activity AS candidate USING (id)
      CROSS JOIN source
      WHERE candidate.id = source.id
         OR (
           ST_Length(candidate.track) / NULLIF(ST_Length(source.track), 0)
             BETWEEN ${ROUTE_MIN_LENGTH_RATIO} AND ${ROUTE_MAX_LENGTH_RATIO}
           AND ST_DWithin(
             ST_StartPoint(candidate.track::geometry)::geography,
             ST_StartPoint(source.track::geometry)::geography,
             ${ROUTE_ENDPOINT_TOLERANCE_METERS}
           )
           AND ST_DWithin(
             ST_EndPoint(candidate.track::geometry)::geography,
             ST_EndPoint(source.track::geometry)::geography,
             ${ROUTE_ENDPOINT_TOLERANCE_METERS}
           )
           AND ST_FrechetDistance(
             ST_Transform(kondis_normalize_route(candidate.track), 3857),
             ST_Transform(source.normalized_track, 3857)
           ) <= ${ROUTE_FRECHET_TOLERANCE_METERS}
         )
    `.execute(executor);

    return rows.map(({ id }) => id);
  }

  private async refreshRouteMatches(activityId: string, executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('activity_route_match').where('activity_id', '=', activityId).execute();
    await executor.deleteFrom('activity_route_match').where('matched_activity_id', '=', activityId).execute();

    const ids = await this.computeMatchingRouteIds(activityId, executor);
    if (ids.length === 0) {
      return;
    }

    await executor
      .insertInto('activity_route_match')
      .values(
        ids.flatMap((matchedId) => [
          { activity_id: activityId, matched_activity_id: matchedId },
          { activity_id: matchedId, matched_activity_id: activityId },
        ]),
      )
      .onConflict((conflict) => conflict.doNothing())
      .execute();
  }

  async recomputeRouteMatches(activityId: string): Promise<boolean> {
    return this.db.transaction().execute(async (trx) => {
      const activity = await trx.selectFrom('activity').select('id').where('id', '=', activityId).executeTakeFirst();
      if (!activity) {
        return false;
      }

      await this.refreshRouteMatches(activityId, trx);
      await trx
        .updateTable('activity')
        .set({ route_matches_computed_at: sql`now()` })
        .where('id', '=', activityId)
        .execute();
      return true;
    });
  }

  async setMetrics(activityId: string, metrics: ActivityMetrics, executor?: KondisExecutor): Promise<boolean> {
    if (executor) {
      return this.setMetricsWithExecutor(activityId, metrics, executor);
    }
    return this.db.transaction().execute((trx) => this.setMetricsWithExecutor(activityId, metrics, trx));
  }

  private async setMetricsWithExecutor(
    activityId: string,
    metrics: ActivityMetrics,
    executor: KondisExecutor,
  ): Promise<boolean> {
    const activity = await executor.selectFrom('activity').select('id').where('id', '=', activityId).executeTakeFirst();
    if (!activity) {
      return false;
    }

    await executor
      .insertInto('activity_metric')
      .values({ activity_id: activityId, ...metrics })
      .onConflict((conflict) => conflict.column('activity_id').doUpdateSet(metrics))
      .execute();
    await executor
      .updateTable('activity')
      .set({ metrics_computed_at: sql`now()` })
      .where('id', '=', activityId)
      .execute();
    return true;
  }

  async listMatchedRoutes(activityId: string): Promise<ActivityRecord[]> {
    const rows = await this.db
      .selectFrom('activity_route_match')
      .select('matched_activity_id')
      .where('activity_id', '=', activityId)
      .execute();

    const ids = rows.map(({ matched_activity_id }) => matched_activity_id);
    if (ids.length === 0) {
      return [];
    }

    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('activity_metric')
            .select(METRIC_COLUMNS)
            .whereRef('activity_metric.activity_id', '=', 'activity.id'),
        ).as('metrics'),
      )
      .where('activity.id', 'in', ids)
      .orderBy('activity.started_at', 'asc')
      .orderBy('activity.id', 'asc')
      .execute();
  }

  getByUploadId(uploadId: string) {
    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('activity_metric')
            .select(METRIC_COLUMNS)
            .whereRef('activity_metric.activity_id', '=', 'activity.id'),
        ).as('metrics'),
      )
      .where('upload_id', '=', uploadId)
      .executeTakeFirst();
  }

  listRecentPage({ limit, cursor }: { limit: number; cursor?: ActivityCursor }) {
    let query = this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('activity_metric')
            .select(METRIC_COLUMNS)
            .whereRef('activity_metric.activity_id', '=', 'activity.id'),
        ).as('metrics'),
      );

    if (cursor) {
      query = query.where(({ and, eb, or }) =>
        or([
          eb('activity.started_at', '<', cursor.startedAt),
          and([eb('activity.started_at', '=', cursor.startedAt), eb('activity.id', '<', cursor.id)]),
        ]),
      );
    }

    return query.orderBy('activity.started_at', 'desc').orderBy('activity.id', 'desc').limit(limit).execute();
  }

  async count(): Promise<number> {
    const row = await this.db
      .selectFrom('activity')
      .select(({ fn }) => fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }

  getStreams(activityId: string): Promise<ActivityStream[]> {
    return this.db.selectFrom('activity_stream').selectAll().where('activity_id', '=', activityId).execute();
  }

  getBestEfforts(activityId: string) {
    return this.db
      .selectFrom('activity_best_effort')
      .selectAll()
      .where('activity_id', '=', activityId)
      .orderBy('distance', 'asc')
      .execute();
  }

  listBestEfforts(type: BestEffortType, sports: ActivityType[]) {
    return this.db
      .selectFrom('activity_best_effort')
      .innerJoin('activity', 'activity.id', 'activity_best_effort.activity_id')
      .select([
        'activity_best_effort.activity_id',
        'activity_best_effort.elapsed_time',
        'activity_best_effort.value',
        'activity_best_effort.value_kind',
        'activity_best_effort.overall_rank',
        'activity_best_effort.year',
        'activity_best_effort.year_rank',
        'activity.name',
        'activity.sport',
        'activity.started_at',
      ])
      .where('activity_best_effort.type', '=', type)
      .where('activity.sport', 'in', sports)
      .orderBy('activity.started_at', 'asc')
      .orderBy('activity.id', 'asc')
      .execute();
  }

  listTopBestEfforts(activityIds: string[]) {
    return this.db
      .selectFrom('activity_best_effort')
      .select(['activity_best_effort.activity_id', 'activity_best_effort.type', 'activity_best_effort.year_rank'])
      .where('activity_best_effort.activity_id', 'in', activityIds)
      .where('activity_best_effort.year_rank', '<=', 3)
      .execute();
  }

  listAvailableBestEffortTypes(sports: ActivityType[]) {
    return this.db
      .selectFrom('activity_best_effort')
      .innerJoin('activity', 'activity.id', 'activity_best_effort.activity_id')
      .select('activity_best_effort.type')
      .distinct()
      .where('activity.sport', 'in', sports)
      .execute();
  }

  async update(id: string, input: UpdateActivityInput) {
    const updated = await this.db.transaction().execute(async (trx) => {
      const row = await trx.updateTable('activity').set(input).where('id', '=', id).returning('id').executeTakeFirst();
      if (!row || input.sport === undefined) {
        return row;
      }

      await trx.deleteFrom('activity_best_effort').where('activity_id', '=', id).execute();
      await trx.deleteFrom('activity_route_match').where('activity_id', '=', id).execute();
      await trx.deleteFrom('activity_route_match').where('matched_activity_id', '=', id).execute();
      await trx
        .updateTable('activity')
        .set({ best_efforts_computed_at: null, route_matches_computed_at: null })
        .where('id', '=', id)
        .execute();
      return row;
    });
    return updated ? this.getById(updated.id) : undefined;
  }

  async recomputeBestEfforts(activityId: string): Promise<boolean | null> {
    return this.db.transaction().execute(async (trx) => {
      const activity = await trx.selectFrom('activity').select('sport').where('id', '=', activityId).executeTakeFirst();
      if (!activity) {
        return false;
      }

      const [streams, metrics] = await Promise.all([
        trx.selectFrom('activity_stream').selectAll().where('activity_id', '=', activityId).execute(),
        trx
          .selectFrom('activity_metric')
          .select(['elapsed_time', 'distance', 'elevation_gain'])
          .where('activity_id', '=', activityId)
          .executeTakeFirst(),
      ]);
      if (!metrics) {
        return null;
      }

      await trx.deleteFrom('activity_best_effort').where('activity_id', '=', activityId).execute();
      await this.insertBestEfforts(trx, activityId, activity.sport, streams, metrics);
      await trx
        .updateTable('activity')
        .set({ best_efforts_computed_at: sql`now()` })
        .where('id', '=', activityId)
        .execute();
      return true;
    });
  }

  async refreshBestEffortRankings(): Promise<void> {
    await sql`SELECT kondis_refresh_best_effort_rankings()`.execute(this.db);
  }

  private async insertBestEfforts(
    executor: KondisExecutor,
    activityId: string,
    sport: ActivityType,
    streams: ActivityStreamInput[],
    metrics: { elapsed_time: number; distance?: number | null; elevation_gain?: number | null },
  ): Promise<void> {
    const bestEffortGroup = getActivityTypeSettings(sport).bestEffortGroup;
    if (bestEffortGroup === BestEffortGroup.None) {
      return;
    }

    const distance = streams.find((stream) => stream.type === 'distance')?.data ?? [];
    const time = streams.find((stream) => stream.type === 'time')?.data ?? [];
    const efforts = bestEffortGroup === BestEffortGroup.Run ? computeRunningBestEfforts(distance, time) : [];
    if (bestEffortGroup === BestEffortGroup.Ride) {
      efforts.push(
        ...computeCyclingBestEfforts(distance, time),
        ...computeCyclingSummaryBestEfforts({
          distance: metrics.distance ?? null,
          elevationGain: metrics.elevation_gain ?? null,
          elapsedTime: metrics.elapsed_time,
        }),
        ...computeCyclingPowerBestEfforts(streams.find((stream) => stream.type === 'power')?.data ?? [], time),
      );
      const biggestClimb = computeBiggestClimb(streams.find((stream) => stream.type === 'altitude')?.data ?? [], time);
      if (biggestClimb) {
        efforts.push(biggestClimb);
      }
    }
    if (efforts.length === 0) {
      return;
    }

    const heartRate = timedValues(
      time,
      streams.find((stream) => stream.type === 'heartrate')?.data ?? [],
      (value) => value >= 1 && value <= 300,
    );
    const altitude = timedValues(
      time,
      streams.find((stream) => stream.type === 'altitude')?.data ?? [],
      (value) => value >= -1000 && value <= 10_000,
    );

    await executor
      .insertInto('activity_best_effort')
      .values(
        efforts.map((effort) => {
          const effortHeartRate = heartRate.filter(
            (point) => point.time >= effort.startTime && point.time <= effort.endTime,
          );
          const startAltitude = valueAtTime(altitude, effort.startTime);
          const endAltitude = valueAtTime(altitude, effort.endTime);
          return {
            activity_id: activityId,
            type: effort.type,
            distance: effort.distance,
            elapsed_time: effort.elapsedTime,
            start_time: effort.startTime,
            end_time: effort.endTime,
            value: effort.value,
            value_kind: effort.valueKind,
            avg_hr:
              effortHeartRate.length === 0
                ? null
                : Math.round(effortHeartRate.reduce((sum, point) => sum + point.value, 0) / effortHeartRate.length),
            elevation_change: startAltitude === null || endAltitude === null ? null : endAltitude - startAltitude,
          };
        }),
      )
      .onConflict((conflict) => conflict.columns(['activity_id', 'type']).doNothing())
      .execute();
  }

  async delete(id: string, executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('activity').where('id', '=', id).execute();
  }
}
