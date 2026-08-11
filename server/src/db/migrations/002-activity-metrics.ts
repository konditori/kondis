import { Kysely, sql } from 'kysely';

const metricColumns = sql.raw(`
  elapsed_time, moving_time, distance, elevation_gain, elevation_loss,
  avg_speed, max_speed, avg_hr, max_hr, avg_cadence, max_cadence,
  avg_power, max_power, normalized_power, calories
`);

export async function up(db: Kysely<unknown>): Promise<void> {
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
    INSERT INTO activity_metric (activity_id, ${metricColumns})
    SELECT id, ${metricColumns} FROM activity
  `.execute(db);

  await sql`
    ALTER TABLE activity
      DROP COLUMN elapsed_time,
      DROP COLUMN moving_time,
      DROP COLUMN distance,
      DROP COLUMN elevation_gain,
      DROP COLUMN elevation_loss,
      DROP COLUMN avg_speed,
      DROP COLUMN max_speed,
      DROP COLUMN avg_hr,
      DROP COLUMN max_hr,
      DROP COLUMN avg_cadence,
      DROP COLUMN max_cadence,
      DROP COLUMN avg_power,
      DROP COLUMN max_power,
      DROP COLUMN normalized_power,
      DROP COLUMN calories
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE activity
      ADD COLUMN elapsed_time integer,
      ADD COLUMN moving_time integer,
      ADD COLUMN distance double precision,
      ADD COLUMN elevation_gain double precision,
      ADD COLUMN elevation_loss double precision,
      ADD COLUMN avg_speed double precision,
      ADD COLUMN max_speed double precision,
      ADD COLUMN avg_hr integer,
      ADD COLUMN max_hr integer,
      ADD COLUMN avg_cadence integer,
      ADD COLUMN max_cadence integer,
      ADD COLUMN avg_power integer,
      ADD COLUMN max_power integer,
      ADD COLUMN normalized_power integer,
      ADD COLUMN calories integer
  `.execute(db);

  await sql`
    UPDATE activity
    SET (${metricColumns}) = (
      SELECT ${metricColumns} FROM activity_metric WHERE activity_metric.activity_id = activity.id
    )
  `.execute(db);

  await sql`ALTER TABLE activity ALTER COLUMN elapsed_time SET NOT NULL`.execute(db);
  await sql`DROP TABLE activity_metric`.execute(db);
}
