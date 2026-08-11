import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity ADD COLUMN detail_track geography(LineString, 4326)`.execute(db);
  await sql`
    UPDATE activity
    SET detail_track = tracks.track
    FROM (
      SELECT
        latitude.activity_id,
        ST_MakeLine(
          ST_SetSRID(ST_MakePoint(points.longitude, points.latitude), 4326)
          ORDER BY points.ordinality
        )::geography AS track
      FROM activity_stream AS latitude
      INNER JOIN activity_stream AS longitude
        ON longitude.activity_id = latitude.activity_id AND longitude.type = 'longitude'
      CROSS JOIN LATERAL unnest(latitude.data, longitude.data) WITH ORDINALITY
        AS points(latitude, longitude, ordinality)
      WHERE latitude.type = 'latitude'
        AND points.latitude BETWEEN -90 AND 90
        AND points.longitude BETWEEN -180 AND 180
      GROUP BY latitude.activity_id
      HAVING COUNT(*) >= 2
    ) AS tracks
    WHERE activity.id = tracks.activity_id
  `.execute(db);

  await sql`ALTER TABLE activity_best_effort ADD COLUMN year integer NOT NULL DEFAULT 1`.execute(db);
  await sql`ALTER TABLE activity_best_effort ADD COLUMN overall_rank integer NOT NULL DEFAULT 1`.execute(db);
  await sql`ALTER TABLE activity_best_effort ADD COLUMN year_rank integer NOT NULL DEFAULT 1`.execute(db);
  await sql`
    CREATE FUNCTION kondis_refresh_best_effort_rankings() RETURNS void AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('kondis:best-effort-rankings'));

      WITH ranked AS (
        SELECT
          activity_best_effort.activity_id,
          activity_best_effort.type,
          EXTRACT(
            YEAR FROM (activity.started_at AT TIME ZONE 'UTC') +
              COALESCE(activity.timezone_offset_minutes, 0) * INTERVAL '1 minute'
          )::integer AS year,
          ROW_NUMBER() OVER (
            PARTITION BY
              CASE
                WHEN activity.sport IN ('run', 'trail_run', 'virtual_run') THEN 'run'
                ELSE 'ride'
              END,
              activity_best_effort.type
            ORDER BY
              CASE WHEN activity_best_effort.value_kind = 'duration' THEN activity_best_effort.value END ASC NULLS LAST,
              CASE WHEN activity_best_effort.value_kind <> 'duration' THEN activity_best_effort.value END DESC NULLS LAST,
              activity_best_effort.activity_id ASC
          )::integer AS overall_rank,
          ROW_NUMBER() OVER (
            PARTITION BY
              CASE
                WHEN activity.sport IN ('run', 'trail_run', 'virtual_run') THEN 'run'
                ELSE 'ride'
              END,
              activity_best_effort.type,
              EXTRACT(
                YEAR FROM (activity.started_at AT TIME ZONE 'UTC') +
                  COALESCE(activity.timezone_offset_minutes, 0) * INTERVAL '1 minute'
              )
            ORDER BY
              CASE WHEN activity_best_effort.value_kind = 'duration' THEN activity_best_effort.value END ASC NULLS LAST,
              CASE WHEN activity_best_effort.value_kind <> 'duration' THEN activity_best_effort.value END DESC NULLS LAST,
              activity_best_effort.activity_id ASC
          )::integer AS year_rank
        FROM activity_best_effort
        INNER JOIN activity ON activity.id = activity_best_effort.activity_id
      )
      UPDATE activity_best_effort
      SET
        year = ranked.year,
        overall_rank = ranked.overall_rank,
        year_rank = ranked.year_rank
      FROM ranked
      WHERE activity_best_effort.activity_id = ranked.activity_id
        AND activity_best_effort.type = ranked.type
        AND (
          activity_best_effort.year,
          activity_best_effort.overall_rank,
          activity_best_effort.year_rank
        ) IS DISTINCT FROM (ranked.year, ranked.overall_rank, ranked.year_rank);
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);
  await sql`SELECT kondis_refresh_best_effort_rankings()`.execute(db);
  await sql`
    ALTER TABLE activity_best_effort
      ADD CONSTRAINT activity_best_effort_year_check CHECK (year >= 1),
      ADD CONSTRAINT activity_best_effort_overall_rank_check CHECK (overall_rank >= 1),
      ADD CONSTRAINT activity_best_effort_year_rank_check CHECK (year_rank >= 1)
  `.execute(db);
  await sql`
    CREATE INDEX activity_best_effort_type_rank_idx
      ON activity_best_effort (type, year, year_rank, overall_rank)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP FUNCTION kondis_refresh_best_effort_rankings`.execute(db);
  await sql`DROP INDEX activity_best_effort_type_rank_idx`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP COLUMN year_rank`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP COLUMN overall_rank`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP COLUMN year`.execute(db);
  await sql`ALTER TABLE activity DROP COLUMN detail_track`.execute(db);
}
