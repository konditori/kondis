import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';

import { KYSELY, KondisDatabase } from 'src/db/database';
import { ActivityStream, NewActivity, NewLap, StreamType } from 'src/db/schema';

/** ~2m in degrees. Enough detail for map rendering; full fidelity stays in activity_stream. */
const TRACK_SIMPLIFY_TOLERANCE_DEG = 0.00002;

/**
 * Selected explicitly rather than via selectAll() because `track` is a PostGIS geography:
 * reading it directly yields WKB hex, so it is projected as GeoJSON instead.
 */
const ACTIVITY_COLUMNS = [
  'id',
  'upload_id',
  'sport',
  'sub_sport',
  'name',
  'started_at',
  'timezone_offset_minutes',
  'elapsed_time_s',
  'moving_time_s',
  'distance_m',
  'elevation_gain_m',
  'elevation_loss_m',
  'avg_speed_mps',
  'max_speed_mps',
  'avg_hr',
  'max_hr',
  'avg_cadence',
  'max_cadence',
  'avg_power',
  'max_power',
  'normalized_power',
  'calories',
  'created_at',
  'updated_at',
] as const;

export type ActivityStreamInput = { type: StreamType; data: number[] };

export type CreateActivityInput = {
  activity: Omit<NewActivity, 'track'>;
  streams: ActivityStreamInput[];
  laps: Omit<NewLap, 'activity_id' | 'id'>[];
};

@Injectable()
export class ActivityRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

  /**
   * Derives the map track from the latitude/longitude streams so the geometry can never
   * drift out of sync with the samples it was built from.
   */
  private buildTrack(streams: ActivityStreamInput[]) {
    const latitude = streams.find((stream) => stream.type === 'latitude')?.data;
    const longitude = streams.find((stream) => stream.type === 'longitude')?.data;
    if (!latitude || !longitude) {
      return null;
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

    if (coordinates.length < 2) {
      return null;
    }

    const geojson = JSON.stringify({ type: 'LineString', coordinates });
    const tolerance = TRACK_SIMPLIFY_TOLERANCE_DEG;
    return sql`ST_Simplify(ST_SetSRID(ST_GeomFromGeoJSON(${geojson}), 4326), ${tolerance})::geography`;
  }

  /** Activity, streams and laps are written together or not at all. Returns the new id. */
  async create(input: CreateActivityInput): Promise<string> {
    return this.db.transaction().execute(async (trx) => {
      const { id } = await trx
        .insertInto('activity')
        .values({ ...input.activity, track: this.buildTrack(input.streams) })
        .returning('id')
        .executeTakeFirstOrThrow();

      if (input.streams.length > 0) {
        await trx
          .insertInto('activity_stream')
          .values(input.streams.map((stream) => ({ activity_id: id, type: stream.type, data: stream.data })))
          .execute();
      }

      if (input.laps.length > 0) {
        await trx
          .insertInto('lap')
          .values(input.laps.map((lap) => ({ ...lap, activity_id: id })))
          .execute();
      }

      return id;
    });
  }

  getById(id: string) {
    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .select(sql<string | null>`ST_AsGeoJSON(track)`.as('track_geojson'))
      .where('id', '=', id)
      .executeTakeFirst();
  }

  getByUploadId(uploadId: string) {
    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .where('upload_id', '=', uploadId)
      .executeTakeFirst();
  }

  listRecent(limit = 50) {
    return this.db
      .selectFrom('activity')
      .select(ACTIVITY_COLUMNS)
      .orderBy('started_at', 'desc')
      .limit(limit)
      .execute();
  }

  getStreams(activityId: string): Promise<ActivityStream[]> {
    return this.db.selectFrom('activity_stream').selectAll().where('activity_id', '=', activityId).execute();
  }
}
