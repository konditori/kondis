import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE live_workout (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      client_session_id uuid NOT NULL,
      sport text NOT NULL,
      started_at timestamptz NOT NULL,
      status text NOT NULL CHECK (status IN ('recording', 'paused', 'ended', 'discarded')),
      elapsed_seconds integer NOT NULL DEFAULT 0 CHECK (elapsed_seconds >= 0),
      distance_meters double precision NOT NULL DEFAULT 0 CHECK (distance_meters >= 0),
      last_sequence bigint NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
      last_point_at timestamptz,
      last_received_at timestamptz,
      share_token_hash text UNIQUE,
      share_expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, client_session_id)
    )
  `.execute(db);
  await sql`
    CREATE TRIGGER live_workout_set_updated_at BEFORE UPDATE ON live_workout
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);
  await sql`CREATE INDEX live_workout_user_status_idx ON live_workout (user_id, status, started_at DESC)`.execute(db);

  await sql`
    CREATE TABLE live_workout_point (
      live_workout_id uuid NOT NULL REFERENCES live_workout (id) ON DELETE CASCADE,
      sequence bigint NOT NULL CHECK (sequence > 0),
      recorded_at timestamptz NOT NULL,
      latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
      longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
      altitude double precision,
      accuracy_meters real NOT NULL CHECK (accuracy_meters >= 0),
      PRIMARY KEY (live_workout_id, sequence)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS live_workout_point`.execute(db);
  await sql`DROP TABLE IF EXISTS live_workout`.execute(db);
}
