import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';

import { KondisDatabase, KondisExecutor, KYSELY } from 'src/db/database';
import {
  Activity,
  ActivityMetric,
  ActivityStream,
  ActivityUpdate,
  NewActivity,
  NewActivityMetric,
  NewLap,
  StreamType,
} from 'src/db/schema';
import { ActivityType, BestEffortGroup, BestEffortType } from 'src/types';
import { getActivityTypeSettings } from 'src/utils/activity';
import {
  computeBiggestClimb,
  computeCyclingBestEfforts,
  computeCyclingPowerBestEfforts,
  computeCyclingSummaryBestEfforts,
  computeRunningBestEfforts,
} from 'src/utils/best-effort';

const TRACK_SIMPLIFY_TOLERANCE_DEG = 0.00002;
const ACTIVITY_COLUMNS = [
  'activity.id',
  'activity.upload_id',
  'activity.sport',
  'activity.name',
  'activity.description',
  'activity.started_at',
  'activity.timezone_offset_minutes',
  'activity.created_at',
  'activity.updated_at',
] as const;

export type ActivityStreamInput = { type: StreamType; data: number[] };

export type CreateActivityInput = {
  activity: Omit<NewActivity, 'detail_track' | 'track'>;
  metrics: Omit<NewActivityMetric, 'activity_id'>;
  streams: ActivityStreamInput[];
  laps: Omit<NewLap, 'activity_id' | 'id'>[];
};

export type ActivityRecord = Omit<Activity, 'detail_track' | 'route_embedding' | 'track'> & ActivityMetric;

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

  async create(input: CreateActivityInput): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto('activity')
        .values({
          ...input.activity,
          track: this.buildTrack(input.streams, true),
          detail_track: this.buildTrack(input.streams, false),
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('activity_metric')
        .values({ activity_id: id, ...input.metrics })
        .execute();

      if (input.streams.length > 0) {
        await trx
          .insertInto('activity_stream')
          .values(input.streams.map((stream) => ({ activity_id: id, type: stream.type, data: stream.data })))
          .execute();
      }

      await this.insertBestEfforts(trx, id, input.activity.sport, input.streams, input.metrics);

      if (input.laps.length > 0) {
        await trx
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
    });
  }

  getById(id: string) {
    return this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .select(ACTIVITY_COLUMNS)
      .selectAll('activity_metric')
      .where('activity.id', '=', id)
      .executeTakeFirst();
  }

  getDetailById(id: string) {
    return this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .select(ACTIVITY_COLUMNS)
      .selectAll('activity_metric')
      .select(sql<string | null>`ST_AsGeoJSON(track)`.as('track_geojson'))
      .select(sql<string | null>`ST_AsGeoJSON(detail_track)`.as('detail_track_geojson'))
      .where('activity.id', '=', id)
      .executeTakeFirst();
  }

  async listMatchedRoutes(activityId: string): Promise<ActivityRecord[]> {
    const { rows } = await sql<{ id: string }>`
      WITH source AS MATERIALIZED (
        SELECT id, sport, track, route_embedding
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
          AND ST_DWithin(candidate.track, source.track, 250)
        ORDER BY candidate.route_embedding <-> source.route_embedding
        LIMIT 250
      )
      SELECT candidate.id
      FROM candidates
      JOIN activity AS candidate USING (id)
      CROSS JOIN source
      WHERE candidate.id = source.id
         OR (
           ST_Length(candidate.track) / NULLIF(ST_Length(source.track), 0) BETWEEN 0.88 AND 1.14
           AND (
             (
               ST_DWithin(
                 ST_StartPoint(candidate.track::geometry)::geography,
                 ST_StartPoint(source.track::geometry)::geography,
                 120
               )
               AND ST_DWithin(
                 ST_EndPoint(candidate.track::geometry)::geography,
                 ST_EndPoint(source.track::geometry)::geography,
                 120
               )
             ) OR (
               ST_DWithin(
                 ST_StartPoint(candidate.track::geometry)::geography,
                 ST_EndPoint(source.track::geometry)::geography,
                 120
               )
               AND ST_DWithin(
                 ST_EndPoint(candidate.track::geometry)::geography,
                 ST_StartPoint(source.track::geometry)::geography,
                 120
               )
             )
           )
           AND ST_HausdorffDistance(
             ST_Transform(candidate.track::geometry, 3857),
             ST_Transform(source.track::geometry, 3857),
             0.05
           ) <= 100
         )
    `.execute(this.db);

    const ids = rows.map(({ id }) => id);
    if (ids.length === 0) {
      return [];
    }

    return this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .select(ACTIVITY_COLUMNS)
      .selectAll('activity_metric')
      .where('activity.id', 'in', ids)
      .orderBy('activity.started_at', 'asc')
      .orderBy('activity.id', 'asc')
      .execute();
  }

  getByUploadId(uploadId: string) {
    return this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .select(ACTIVITY_COLUMNS)
      .selectAll('activity_metric')
      .where('upload_id', '=', uploadId)
      .executeTakeFirst();
  }

  listRecentPage({ limit, cursor }: { limit: number; cursor?: ActivityCursor }) {
    let query = this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .select(ACTIVITY_COLUMNS)
      .selectAll('activity_metric');

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
      return row;
    });
    return updated ? this.getById(updated.id) : undefined;
  }

  async recomputeBestEfforts(activityId: string): Promise<boolean> {
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
          .executeTakeFirstOrThrow(),
      ]);

      await trx.deleteFrom('activity_best_effort').where('activity_id', '=', activityId).execute();
      await this.insertBestEfforts(trx, activityId, activity.sport, streams, metrics);
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
