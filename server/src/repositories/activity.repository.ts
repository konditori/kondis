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
import {
  ActivityType,
  supportsCyclingBestEfforts,
  supportsDistanceBestEfforts,
  supportsRunningBestEfforts,
} from 'src/domain/activity-type';
import {
  BestEffortType,
  computeBiggestClimb,
  computeCyclingBestEfforts,
  computeCyclingPowerBestEfforts,
  computeCyclingSummaryBestEfforts,
  computeRunningBestEfforts,
} from 'src/domain/running-best-effort';

const TRACK_SIMPLIFY_TOLERANCE_DEG = 0.00002;

export type ActivityStreamInput = { type: StreamType; data: number[] };

export type CreateActivityInput = {
  activity: Omit<NewActivity, 'track'>;
  metrics: Omit<NewActivityMetric, 'activity_id'>;
  streams: ActivityStreamInput[];
  laps: Omit<NewLap, 'activity_id' | 'id'>[];
};

export type ActivityRecord = Activity & ActivityMetric;

export type UpdateActivityInput = Pick<ActivityUpdate, 'name' | 'description' | 'sport' | 'started_at'>;

export type ActivityCursor = {
  startedAt: Date;
  id: string;
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

  private buildTrack(streams: ActivityStreamInput[]) {
    const coordinates = this.trackCoordinates(streams);
    if (coordinates.length < 2) {
      return null;
    }

    const geojson = JSON.stringify({ type: 'LineString', coordinates });
    const tolerance = TRACK_SIMPLIFY_TOLERANCE_DEG;
    return sql`ST_Simplify(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326), ${tolerance})::geography`;
  }

  async create(input: CreateActivityInput): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto('activity')
        .values({ ...input.activity, track: this.buildTrack(input.streams) })
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
      .selectAll('activity')
      .selectAll('activity_metric')
      .select(sql<string | null>`ST_AsGeoJSON(track)`.as('track_geojson'))
      .where('activity.id', '=', id)
      .executeTakeFirst();
  }

  getByUploadId(uploadId: string) {
    return this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .selectAll('activity')
      .selectAll('activity_metric')
      .where('upload_id', '=', uploadId)
      .executeTakeFirst();
  }

  listRecentPage({ limit, cursor }: { limit: number; cursor?: ActivityCursor }) {
    let query = this.db
      .selectFrom('activity')
      .innerJoin('activity_metric', 'activity_metric.activity_id', 'activity.id')
      .selectAll('activity')
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

  async getTrackCoordinates(activityId: string): Promise<[number, number][]> {
    const streams = await this.db
      .selectFrom('activity_stream')
      .selectAll()
      .where('activity_id', '=', activityId)
      .where('type', 'in', ['latitude', 'longitude'])
      .execute();
    return this.trackCoordinates(streams);
  }

  getBestEfforts(activityId: string) {
    return this.db
      .selectFrom('activity_best_effort')
      .selectAll()
      .where('activity_id', '=', activityId)
      .orderBy('distance', 'asc')
      .execute();
  }

  listActivitiesMissingBestEfforts() {
    return this.db
      .selectFrom('activity')
      .leftJoin('activity_best_effort', 'activity_best_effort.activity_id', 'activity.id')
      .select(['activity.id', 'activity.sport'])
      .where('activity_best_effort.activity_id', 'is', null)
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
        'activity.name',
        'activity.sport',
        'activity.started_at',
        'activity.timezone_offset_minutes',
      ])
      .where('activity_best_effort.type', '=', type)
      .where('activity.sport', 'in', sports)
      .orderBy('activity.started_at', 'asc')
      .orderBy('activity.id', 'asc')
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

  async ensureBestEfforts(activityId: string, sport: ActivityType): Promise<void> {
    if (!supportsDistanceBestEfforts(sport)) {
      return;
    }

    const existing = await this.db
      .selectFrom('activity_best_effort')
      .select('type')
      .where('activity_id', '=', activityId)
      .limit(1)
      .executeTakeFirst();
    if (existing) {
      return;
    }

    const metrics = await this.db
      .selectFrom('activity_metric')
      .select(['elapsed_time', 'distance', 'elevation_gain'])
      .where('activity_id', '=', activityId)
      .executeTakeFirstOrThrow();
    await this.insertBestEfforts(this.db, activityId, sport, await this.getStreams(activityId), metrics);
  }

  async update(id: string, input: UpdateActivityInput) {
    const updated = await this.db.transaction().execute(async (trx) => {
      const row = await trx.updateTable('activity').set(input).where('id', '=', id).returning('id').executeTakeFirst();
      if (!row || input.sport === undefined) {
        return row;
      }

      await trx.deleteFrom('activity_best_effort').where('activity_id', '=', id).execute();
      const streams = await trx.selectFrom('activity_stream').selectAll().where('activity_id', '=', id).execute();
      const metrics = await trx
        .selectFrom('activity_metric')
        .select(['elapsed_time', 'distance', 'elevation_gain'])
        .where('activity_id', '=', id)
        .executeTakeFirstOrThrow();
      await this.insertBestEfforts(trx, id, input.sport, streams, metrics);
      return row;
    });
    return updated ? this.getById(updated.id) : undefined;
  }

  private async insertBestEfforts(
    executor: KondisExecutor,
    activityId: string,
    sport: ActivityType,
    streams: ActivityStreamInput[],
    metrics: { elapsed_time: number; distance?: number | null; elevation_gain?: number | null },
  ): Promise<void> {
    if (!supportsDistanceBestEfforts(sport)) {
      return;
    }

    const distance = streams.find((stream) => stream.type === 'distance')?.data ?? [];
    const time = streams.find((stream) => stream.type === 'time')?.data ?? [];
    const efforts = supportsRunningBestEfforts(sport) ? computeRunningBestEfforts(distance, time) : [];
    if (supportsCyclingBestEfforts(sport)) {
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

    await executor
      .insertInto('activity_best_effort')
      .values(
        efforts.map((effort) => ({
          activity_id: activityId,
          type: effort.type,
          distance: effort.distance,
          elapsed_time: effort.elapsedTime,
          start_time: effort.startTime,
          end_time: effort.endTime,
          value: effort.value,
          value_kind: effort.valueKind,
        })),
      )
      .onConflict((conflict) => conflict.columns(['activity_id', 'type']).doNothing())
      .execute();
  }

  async delete(id: string, executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('activity').where('id', '=', id).execute();
  }
}
