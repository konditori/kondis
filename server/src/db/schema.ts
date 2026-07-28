import type { ColumnType, Insertable, RawBuilder, Selectable, Updateable } from 'kysely';

import { StreamType, UploadStatus } from 'src/types';

/**
 * Hand-written database types.
 *
 * `pnpm db:codegen` writes `schema.generated.ts` from a live database; treat that as the
 * source of truth to diff against and keep this file in sync. It is hand-written for now
 * so the types exist before a database has ever been migrated.
 */

/** Column with a database-side default, so it is optional on insert. */
type Defaulted<T> = ColumnType<T, T | undefined, T>;
type DefaultedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

/**
 * PostGIS geography columns are never read or written directly. Writes pass a raw
 * `ST_GeomFromGeoJSON(...)` expression, and reads project `ST_AsGeoJSON(track)` into a
 * separate alias. Typing it this way makes a direct `select('track')` useless on purpose.
 */
type GeographyWrite = RawBuilder<unknown> | null | undefined;
type Geography = ColumnType<string | null, GeographyWrite, GeographyWrite>;

export interface UploadTable {
  id: Defaulted<string>;
  /** Lowercase hex SHA-256 of the file bytes. Unique, so re-imports are idempotent. */
  checksum: string;
  original_name: string;
  byte_size: number;
  /** Content-addressed path relative to the configured storage root. */
  storage_path: string;
  status: Defaulted<UploadStatus>;
  error: string | null;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface ActivityTable {
  id: Defaulted<string>;
  upload_id: string;
  sport: string;
  sub_sport: string | null;
  name: string | null;
  started_at: Date | string;
  timezone_offset_minutes: number | null;
  elapsed_time_s: number;
  moving_time_s: number | null;
  distance_m: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  avg_speed_mps: number | null;
  max_speed_mps: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_cadence: number | null;
  max_cadence: number | null;
  avg_power: number | null;
  max_power: number | null;
  normalized_power: number | null;
  calories: number | null;
  /** Simplified track for map rendering and spatial queries. Full fidelity lives in activity_stream. */
  track: Geography;
  created_at: DefaultedTimestamp;
  updated_at: DefaultedTimestamp;
}

export interface ActivityStreamTable {
  activity_id: string;
  type: StreamType;
  data: number[];
}

export interface LapTable {
  id: Defaulted<string>;
  activity_id: string;
  lap_index: number;
  started_at: Date | string | null;
  elapsed_time_s: number | null;
  moving_time_s: number | null;
  distance_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  avg_power: number | null;
  avg_speed_mps: number | null;
}

export interface DB {
  upload: UploadTable;
  activity: ActivityTable;
  activity_stream: ActivityStreamTable;
  lap: LapTable;
}

export type Upload = Selectable<UploadTable>;
export type NewUpload = Insertable<UploadTable>;
export type UploadUpdate = Updateable<UploadTable>;

export type Activity = Selectable<ActivityTable>;
export type NewActivity = Insertable<ActivityTable>;
export type ActivityUpdate = Updateable<ActivityTable>;

export type ActivityStream = Selectable<ActivityStreamTable>;
export type NewActivityStream = Insertable<ActivityStreamTable>;

export type Lap = Selectable<LapTable>;
export type NewLap = Insertable<LapTable>;

export { type StreamType, type UploadStatus } from 'src/types';
