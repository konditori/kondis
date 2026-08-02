import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'kysely';

import { KYSELY, KondisDatabase, KondisExecutor } from 'src/db/database';
import { ActivityStream, NewActivity, NewLap, StreamType } from 'src/db/schema';
import type { ActivityTable } from 'src/schema/tables';

const TRACK_SIMPLIFY_TOLERANCE_DEG = 0.00002;

const ACTIVITY_COLUMNS = Object.keys({} as ActivityTable) as Array<keyof ActivityTable>;

export type ActivityStreamInput = { type: StreamType; data: number[] };

export type CreateActivityInput = {
  activity: Omit<NewActivity, 'track'>;
  streams: ActivityStreamInput[];
  laps: Omit<NewLap, 'activity_id' | 'id'>[];
};

@Injectable()
export class ActivityRepository {
  constructor(@Inject(KYSELY) private readonly db: KondisDatabase) {}

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
      .select(ACTIVITY_COLUMNS)
      .select(sql<string | null>`ST_AsGeoJSON(track)`.as('track_geojson'))
      .where('id', '=', id)
      .executeTakeFirst();
  }

  getByUploadId(uploadId: string) {
    return this.db.selectFrom('activity').select(ACTIVITY_COLUMNS).where('upload_id', '=', uploadId).executeTakeFirst();
  }

  listRecent(limit = 50) {
    return this.db.selectFrom('activity').select(ACTIVITY_COLUMNS).orderBy('started_at', 'desc').limit(limit).execute();
  }

  getStreams(activityId: string): Promise<ActivityStream[]> {
    return this.db.selectFrom('activity_stream').selectAll().where('activity_id', '=', activityId).execute();
  }

  /** Streams and laps go with it, by cascade. The upload row is left alone. */
  async delete(id: string, executor: KondisExecutor = this.db): Promise<void> {
    await executor.deleteFrom('activity').where('id', '=', id).execute();
  }
}
