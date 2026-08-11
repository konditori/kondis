import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    UPDATE activity
    SET sport = CASE
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('run', 'running')
        AND lower(coalesce(sub_sport, '')) LIKE '%trail%' THEN 'trail_run'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('run', 'running') THEN 'run'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('trail_run', 'trail_running') THEN 'trail_run'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('ride', 'cycling', 'biking', 'bike') THEN 'ride'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('walk', 'walking') THEN 'walk'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('swim', 'swimming') THEN 'swim'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('alpine_ski', 'alpine_skiing', 'downhill_skiing') THEN 'alpine_ski'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('roller_ski', 'roller_skiing') THEN 'roller_ski'
      WHEN lower(regexp_replace(sport, '[^a-zA-Z0-9]+', '_', 'g')) IN ('cross_country_ski', 'cross_country_skiing', 'nordic_ski', 'nordic_skiing') THEN 'cross_country_ski'
      ELSE 'other'
    END
  `.execute(db);

  await sql`ALTER TABLE activity DROP COLUMN sub_sport`.execute(db);
  await sql`
    ALTER TABLE activity ADD CONSTRAINT activity_sport_check CHECK (
      sport IN ('run', 'ride', 'trail_run', 'walk', 'swim', 'alpine_ski', 'roller_ski', 'cross_country_ski', 'other')
    )
  `.execute(db);

  await sql`
    CREATE TABLE activity_best_effort (
      activity_id uuid NOT NULL REFERENCES activity (id) ON DELETE CASCADE,
      type text NOT NULL,
      distance double precision NOT NULL,
      elapsed_time double precision NOT NULL,
      start_time double precision NOT NULL,
      end_time double precision NOT NULL,
      PRIMARY KEY (activity_id, type),
      CONSTRAINT activity_best_effort_type_check CHECK (
        type IN ('400m', '1k', 'half_mile', '1_mile', '2_miles', '5k', '10k', '15k', '10_miles', '20k', 'half_marathon', '30k', 'marathon', '50k')
      ),
      CONSTRAINT activity_best_effort_distance_check CHECK (distance > 0),
      CONSTRAINT activity_best_effort_time_check CHECK (start_time >= 0 AND end_time > start_time AND elapsed_time > 0)
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE activity_best_effort`.execute(db);
  await sql`ALTER TABLE activity DROP CONSTRAINT activity_sport_check`.execute(db);
  await sql`ALTER TABLE activity ADD COLUMN sub_sport text`.execute(db);
}
