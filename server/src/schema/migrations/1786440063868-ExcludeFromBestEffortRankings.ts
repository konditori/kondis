import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE OR REPLACE FUNCTION kondis_refresh_best_effort_rankings() RETURNS void AS $$
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('kondis:best-effort-rankings'));
      WITH efforts AS (
        SELECT effort.activity_id, effort.type, effort.value, effort.value_kind,
          CASE WHEN activity.sport IN ('run', 'trail_run', 'virtual_run') THEN 'run' ELSE 'ride' END AS sport,
          EXTRACT(YEAR FROM (activity.started_at AT TIME ZONE 'UTC') + COALESCE(activity.timezone_offset_minutes, 0) * INTERVAL '1 minute')::integer AS year
        FROM activity_best_effort AS effort
        INNER JOIN activity ON activity.id = effort.activity_id
        WHERE activity.exclude_from_best_efforts = false
      ), ranked AS (
        SELECT activity_id, type, year,
          ROW_NUMBER() OVER (PARTITION BY sport, type ORDER BY CASE WHEN value_kind = 'duration' THEN value END ASC NULLS LAST, CASE WHEN value_kind <> 'duration' THEN value END DESC NULLS LAST, activity_id)::integer AS overall_rank,
          ROW_NUMBER() OVER (PARTITION BY sport, type, year ORDER BY CASE WHEN value_kind = 'duration' THEN value END ASC NULLS LAST, CASE WHEN value_kind <> 'duration' THEN value END DESC NULLS LAST, activity_id)::integer AS year_rank
        FROM efforts
      )
      UPDATE activity_best_effort AS effort
      SET year = ranked.year, overall_rank = ranked.overall_rank, year_rank = ranked.year_rank
      FROM ranked
      WHERE (effort.activity_id, effort.type) = (ranked.activity_id, ranked.type)
        AND (effort.year, effort.overall_rank, effort.year_rank) IS DISTINCT FROM (ranked.year, ranked.overall_rank, ranked.year_rank);
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);
  await sql`SELECT kondis_refresh_best_effort_rankings()`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  void db;
}
