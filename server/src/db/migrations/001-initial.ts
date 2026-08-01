import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);

  await sql`
    CREATE OR REPLACE FUNCTION kondis_set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await sql`
    CREATE TABLE upload (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      checksum text NOT NULL,
      original_name text NOT NULL,
      byte_size bigint NOT NULL,
      storage_path text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT upload_checksum_key UNIQUE (checksum),
      CONSTRAINT upload_status_check CHECK (status IN ('pending', 'parsed', 'failed'))
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER upload_set_updated_at BEFORE UPDATE ON upload
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);

  await sql`
    CREATE TABLE activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      upload_id uuid NOT NULL REFERENCES upload (id) ON DELETE CASCADE,
      sport text NOT NULL,
      sub_sport text,
      name text,
      started_at timestamptz NOT NULL,
      timezone_offset_minutes integer,
      elapsed_time_s integer NOT NULL,
      moving_time_s integer,
      distance_m double precision,
      elevation_gain_m double precision,
      elevation_loss_m double precision,
      avg_speed_mps double precision,
      max_speed_mps double precision,
      avg_hr integer,
      max_hr integer,
      avg_cadence integer,
      max_cadence integer,
      avg_power integer,
      max_power integer,
      normalized_power integer,
      calories integer,
      track geography(LineString, 4326),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT activity_upload_id_key UNIQUE (upload_id)
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER activity_set_updated_at BEFORE UPDATE ON activity
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);

  await sql`CREATE INDEX activity_started_at_idx ON activity (started_at DESC)`.execute(db);
  await sql`CREATE INDEX activity_sport_idx ON activity (sport)`.execute(db);
  await sql`CREATE INDEX activity_track_idx ON activity USING GIST (track)`.execute(db);

  await sql`
    CREATE TABLE activity_stream (
      activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      type text NOT NULL,
      data double precision[] NOT NULL,
      PRIMARY KEY (activity_id, type)
    )
  `.execute(db);

  await sql`
    CREATE TABLE lap (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      lap_index integer NOT NULL,
      started_at timestamptz,
      elapsed_time_s integer,
      moving_time_s integer,
      distance_m double precision,
      avg_hr integer,
      max_hr integer,
      avg_power integer,
      avg_speed_mps double precision,
      CONSTRAINT lap_activity_id_lap_index_key UNIQUE (activity_id, lap_index)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS lap`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_stream`.execute(db);
  await sql`DROP TABLE IF EXISTS activity`.execute(db);
  await sql`DROP TABLE IF EXISTS upload`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_set_updated_at`.execute(db);
}
