import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort ADD COLUMN value double precision`.execute(db);
  await sql`ALTER TABLE activity_best_effort ADD COLUMN value_kind text`.execute(db);
  await sql`UPDATE activity_best_effort SET value = elapsed_time, value_kind = 'duration'`.execute(db);
  await sql`ALTER TABLE activity_best_effort ALTER COLUMN value SET NOT NULL`.execute(db);
  await sql`ALTER TABLE activity_best_effort ALTER COLUMN value_kind SET NOT NULL`.execute(db);
  await sql`ALTER TABLE activity_best_effort ADD CONSTRAINT activity_best_effort_value_check CHECK (value > 0)`.execute(
    db,
  );
  await sql`
    ALTER TABLE activity_best_effort ADD CONSTRAINT activity_best_effort_value_kind_check CHECK (
      value_kind IN ('duration', 'distance', 'elevation', 'power')
    )
  `.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP CONSTRAINT activity_best_effort_type_check`.execute(db);
  await sql`
    ALTER TABLE activity_best_effort ADD CONSTRAINT activity_best_effort_type_check CHECK (
      type IN (
        '400m', '1k', 'half_mile', '1_mile', '2_miles', '5k', '10k', '15k', '10_miles',
        '20k', 'half_marathon', '30k', 'marathon', '50k',
        'longest_ride', 'biggest_climb', 'elevation_gain', '5_miles', '40k', '80k',
        '50_miles', '90k', '100k', '100_miles', '180k',
        'power_5s', 'power_15s', 'power_30s', 'power_1m', 'power_2m', 'power_3m',
        'power_5m', 'power_8m', 'power_10m', 'power_15m', 'power_20m', 'power_30m',
        'power_45m', 'power_1h', 'power_2h'
      )
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DELETE FROM activity_best_effort WHERE type IN (
      'longest_ride', 'biggest_climb', 'elevation_gain', '5_miles', '40k', '80k',
      '50_miles', '90k', '100k', '100_miles', '180k',
      'power_5s', 'power_15s', 'power_30s', 'power_1m', 'power_2m', 'power_3m',
      'power_5m', 'power_8m', 'power_10m', 'power_15m', 'power_20m', 'power_30m',
      'power_45m', 'power_1h', 'power_2h'
    )
  `.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP CONSTRAINT activity_best_effort_type_check`.execute(db);
  await sql`
    ALTER TABLE activity_best_effort ADD CONSTRAINT activity_best_effort_type_check CHECK (
      type IN (
        '400m', '1k', 'half_mile', '1_mile', '2_miles', '5k', '10k', '15k', '10_miles',
        '20k', 'half_marathon', '30k', 'marathon', '50k'
      )
    )
  `.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP CONSTRAINT activity_best_effort_value_kind_check`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP CONSTRAINT activity_best_effort_value_check`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP COLUMN value_kind`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP COLUMN value`.execute(db);
}
