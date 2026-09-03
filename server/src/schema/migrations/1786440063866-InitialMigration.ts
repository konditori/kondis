import { Kysely, sql } from 'kysely';

import { UNRANKED } from 'src/constants';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
  // VectorChord installs pgvector, which supplies the vector type.
  await sql`CREATE EXTENSION IF NOT EXISTS vchord CASCADE`.execute(db);

  await sql`
    CREATE FUNCTION kondis_set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await sql`
    CREATE FUNCTION kondis_route_embedding(route geography)
    RETURNS vector(32) AS $$
      WITH samples AS (
        SELECT
          sample_index,
          ST_Transform(ST_LineInterpolatePoint(route::geometry, sample_index / 15.0), 3857) AS point
        FROM generate_series(0, 15) AS sample_index
      )
      SELECT array_agg(coordinate::real ORDER BY sample_index, axis)::vector(32)
      FROM (
        SELECT sample_index, 0 AS axis, ST_X(point) / 10000.0 AS coordinate FROM samples
        UNION ALL
        SELECT sample_index, 1 AS axis, ST_Y(point) / 10000.0 AS coordinate FROM samples
      ) AS dimensions
  $$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  `.execute(db);

  await sql`
    CREATE TABLE "user" (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      first_name text NOT NULL,
      last_name text NOT NULL,
      password_hash text NOT NULL,
      role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      avatar_path text,
      avatar_mime_type text,
      avatar_size integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`CREATE TRIGGER user_set_updated_at BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()`.execute(db);

  // Uniform samples make Frechet distance independent of GPS recording frequency.
  await sql`
    CREATE FUNCTION kondis_normalize_route(route geography)
    RETURNS geometry AS $$
      SELECT ST_MakeLine(ARRAY(
        SELECT ST_LineInterpolatePoint(route::geometry, sample_index / 64.0)
        FROM generate_series(0, 64) AS sample_index
        ORDER BY sample_index
      ))
    $$ LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
  `.execute(db);

  await sql`
    CREATE TABLE upload (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      checksum text NOT NULL,
      original_name text NOT NULL,
      byte_size bigint NOT NULL,
      storage_path text NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'parsed', 'failed')),
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER upload_set_updated_at BEFORE UPDATE ON upload
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);

  await sql`
    CREATE TABLE activity (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      upload_id uuid NOT NULL UNIQUE REFERENCES upload (id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      sport text NOT NULL CHECK (
        sport IN (
          'alpine_ski', 'backcountry_ski', 'badminton', 'basketball', 'canoeing', 'cricket',
          'cross_country_ski', 'crossfit', 'dance', 'e_bike_ride', 'elliptical', 'e_mountain_bike_ride',
          'golf', 'gravel_ride', 'handcycle', 'high_intensity_interval_training', 'hike', 'ice_skate',
          'inline_skate', 'kayaking', 'kitesurf', 'mountain_bike_ride', 'padel', 'physical_therapy',
          'pickleball', 'pilates', 'racquetball', 'ride', 'rock_climbing', 'roller_ski', 'rowing', 'run',
          'sail', 'skateboard', 'snowboard', 'snowshoe', 'soccer', 'squash', 'stair_stepper',
          'stand_up_paddling', 'surfing', 'swim', 'table_tennis', 'tennis', 'trail_run', 'velomobile',
          'virtual_ride', 'virtual_row', 'virtual_run', 'volleyball', 'walk', 'weight_training',
          'wheelchair', 'windsurf', 'workout', 'yoga', 'other'
        )
      ),
      name text,
      description text,
      tags text[] NOT NULL DEFAULT '{}',
      exclude_from_rankings boolean NOT NULL DEFAULT false,
      started_at timestamptz NOT NULL,
      timezone_offset_minutes integer,
      track geography(LineString, 4326),
      detail_track geography(LineString, 4326),
      route_embedding vector(32) GENERATED ALWAYS AS (kondis_route_embedding(track)) STORED,
      metrics_computed_at timestamptz,
      best_efforts_computed_at timestamptz,
      route_matches_computed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER activity_set_updated_at BEFORE UPDATE ON activity
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);
  await sql`ALTER TABLE activity ADD CONSTRAINT activity_tags_check CHECK (
    tags <@ ARRAY['race','long_run','commute','workout','competition','recovery','with_pet','with_kid','for_a_cause']::text[]
  )`.execute(db);

  await sql`CREATE INDEX activity_started_at_idx ON activity (started_at DESC)`.execute(db);
  await sql`CREATE INDEX activity_sport_idx ON activity (sport)`.execute(db);
  await sql`CREATE INDEX activity_user_started_at_idx ON activity (user_id, started_at DESC)`.execute(db);
  await sql`CREATE UNIQUE INDEX upload_user_checksum_idx ON upload (user_id, checksum)`.execute(db);
  await sql`CREATE INDEX activity_tags_idx ON activity USING GIN (tags)`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
  await sql`CREATE INDEX activity_name_trgm_idx ON activity USING GIN (name gin_trgm_ops)`.execute(db);
  await sql`CREATE INDEX activity_description_trgm_idx ON activity USING GIN (description gin_trgm_ops)`.execute(db);
  await sql`CREATE INDEX activity_sport_trgm_idx ON activity USING GIN (sport gin_trgm_ops)`.execute(db);
  await sql`CREATE INDEX activity_track_idx ON activity USING GIST (track)`.execute(db);
  await sql`
    CREATE INDEX activity_route_embedding_idx
      ON activity USING vchordrq (route_embedding vector_l2_ops)
  `.execute(db);

  await sql`
    CREATE TABLE activity_metric (
      activity_id uuid PRIMARY KEY REFERENCES activity (id) ON DELETE CASCADE,
      elapsed_time integer NOT NULL,
      moving_time integer,
      distance double precision,
      elevation_gain double precision,
      elevation_loss double precision,
      avg_speed double precision,
      max_speed double precision,
      avg_hr integer,
      max_hr integer,
      avg_cadence integer,
      max_cadence integer,
      avg_power integer,
      max_power integer,
      normalized_power integer,
      calories integer
    )
  `.execute(db);

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
      elapsed_time integer,
      moving_time integer,
      distance double precision,
      avg_hr integer,
      max_hr integer,
      avg_power integer,
      avg_speed_mps double precision,
      UNIQUE (activity_id, lap_index)
    )
  `.execute(db);

  await sql`
    CREATE TABLE activity_best_effort (
      activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      type text NOT NULL CONSTRAINT activity_best_effort_type_check CHECK (
        type IN (
          '400m', '1k', 'half_mile', '1_mile', '2_miles', '5k', '10k', '15k', '10_miles',
          '20k', 'half_marathon', '30k', 'marathon', '50k',
          'longest_ride', 'biggest_climb', 'elevation_gain', '5_miles', '10k', '10_miles', '20k', '30k', '40k',
          '50k', '80k', '50_miles', '90k', '100k', '100_miles', '180k',
          'power_5s', 'power_15s', 'power_30s', 'power_1m', 'power_2m', 'power_3m',
          'power_5m', 'power_8m', 'power_10m', 'power_15m', 'power_20m', 'power_30m',
          'power_45m', 'power_1h', 'power_2h'
        )
      ),
      distance double precision NOT NULL CHECK (distance > 0),
      elapsed_time double precision NOT NULL,
      start_time double precision NOT NULL,
      end_time double precision NOT NULL,
      value double precision NOT NULL CHECK (value > 0),
      value_kind text NOT NULL CHECK (value_kind IN ('duration', 'distance', 'elevation', 'power')),
      avg_hr integer CHECK (avg_hr IS NULL OR avg_hr BETWEEN 1 AND 300),
      elevation_change double precision,
      year integer NOT NULL DEFAULT 1 CHECK (year >= 1),
      overall_rank integer NOT NULL DEFAULT ${sql.lit(UNRANKED)} CHECK (overall_rank >= 1),
      year_rank integer NOT NULL DEFAULT ${sql.lit(UNRANKED)} CHECK (year_rank >= 1),
      PRIMARY KEY (activity_id, type),
      CHECK (start_time >= 0 AND end_time > start_time AND elapsed_time > 0)
    )
  `.execute(db);

  await sql`
    CREATE INDEX activity_best_effort_type_rank_idx
      ON activity_best_effort (type, year, year_rank, overall_rank)
  `.execute(db);

  await sql`
    CREATE TABLE activity_route_match (
      activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      matched_activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      PRIMARY KEY (activity_id, matched_activity_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE activity_image (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      upload_id uuid NOT NULL REFERENCES upload (id) ON DELETE CASCADE,
      checksum text NOT NULL,
      original_name text NOT NULL,
      caption text,
      sort_order integer NOT NULL DEFAULT 0,
      mime_type text,
      byte_size bigint,
      width integer,
      height integer,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
      error text,
      processing_version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (upload_id, checksum)
    )
  `.execute(db);
  await sql`
    CREATE TABLE activity_image_file (
      image_id uuid NOT NULL REFERENCES activity_image (id) ON DELETE CASCADE,
      variant text NOT NULL CHECK (variant IN ('original', 'thumbnail', 'preview')),
      storage_path text NOT NULL,
      mime_type text NOT NULL,
      byte_size bigint NOT NULL,
      width integer,
      height integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (image_id, variant),
      UNIQUE (storage_path)
    )
  `.execute(db);
  await sql`CREATE INDEX activity_image_upload_order_idx ON activity_image (upload_id, sort_order, created_at)`.execute(
    db,
  );
  await sql`CREATE INDEX activity_image_status_idx ON activity_image (status)`.execute(db);
  await sql`CREATE TRIGGER activity_image_set_updated_at BEFORE UPDATE ON activity_image
    FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()`.execute(db);

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
      UNIQUE (user_id, client_session_id),
      CHECK ((share_token_hash IS NULL) = (share_expires_at IS NULL))
    )
  `.execute(db);
  await sql`CREATE TRIGGER live_workout_set_updated_at BEFORE UPDATE ON live_workout
    FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()`.execute(db);
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

  await sql`CREATE TABLE follow_request (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    target_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT follow_request_no_self CHECK (requester_id <> target_id),
    UNIQUE (requester_id, target_id)
  )`.execute(db);
  await sql`CREATE INDEX follow_request_target_idx ON follow_request (target_id, created_at DESC)`.execute(db);
  await sql`CREATE TABLE user_follow (
    follower_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    followee_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CONSTRAINT user_follow_no_self CHECK (follower_id <> followee_id)
  )`.execute(db);
  await sql`CREATE INDEX user_follow_followee_idx ON user_follow (followee_id, created_at DESC)`.execute(db);
  await sql`CREATE TABLE user_block (
    blocker_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    blocked_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT user_block_no_self CHECK (blocker_id <> blocked_id)
  )`.execute(db);
  await sql`CREATE TABLE activity_like (
    activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (activity_id, user_id)
  )`.execute(db);
  await sql`CREATE INDEX activity_like_activity_idx ON activity_like (activity_id, created_at DESC)`.execute(db);
  await sql`CREATE TABLE activity_comment (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`.execute(db);
  await sql`CREATE INDEX activity_comment_activity_idx ON activity_comment (activity_id, created_at DESC, id DESC)`.execute(
    db,
  );
  await sql`CREATE TRIGGER activity_comment_set_updated_at BEFORE UPDATE ON activity_comment
    FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()`.execute(db);
  await sql`CREATE TABLE notification (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    actor_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
    type text NOT NULL CHECK (type IN ('activity_like', 'activity_comment', 'follow_request')),
    activity_id uuid REFERENCES activity (id) ON DELETE CASCADE,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (user_id <> actor_id)
  )`.execute(db);
  await sql`CREATE INDEX notification_user_created_idx ON notification (user_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX notification_user_unread_idx ON notification (user_id, created_at DESC) WHERE read_at IS NULL`.execute(
    db,
  );
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE IF EXISTS notification`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_comment`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_like`.execute(db);
  await sql`DROP TABLE IF EXISTS user_block`.execute(db);
  await sql`DROP TABLE IF EXISTS user_follow`.execute(db);
  await sql`DROP TABLE IF EXISTS follow_request`.execute(db);
  await sql`DROP TABLE IF EXISTS live_workout_point`.execute(db);
  await sql`DROP TABLE IF EXISTS live_workout`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_image_file`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_image`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_route_match`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_best_effort`.execute(db);
  await sql`DROP TABLE IF EXISTS lap`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_stream`.execute(db);
  await sql`DROP TABLE IF EXISTS activity_metric`.execute(db);
  await sql`DROP TABLE IF EXISTS activity`.execute(db);
  await sql`DROP TABLE IF EXISTS upload`.execute(db);
  await sql`DROP TABLE IF EXISTS "user"`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_normalize_route(geography)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_route_embedding(geography)`.execute(db);
  await sql`DROP FUNCTION IF EXISTS kondis_set_updated_at()`.execute(db);
}
