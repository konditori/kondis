import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort ADD COLUMN avg_hr integer`.execute(db);
  await sql`ALTER TABLE activity_best_effort ADD COLUMN elevation_change double precision`.execute(db);

  await sql`
    UPDATE activity_best_effort AS effort
    SET avg_hr = (
      SELECT ROUND(AVG(samples.value))::integer
      FROM activity_stream AS time_stream
      INNER JOIN activity_stream AS value_stream
        ON value_stream.activity_id = time_stream.activity_id AND value_stream.type = 'heartrate'
      CROSS JOIN LATERAL unnest(time_stream.data, value_stream.data) AS samples(time, value)
      WHERE time_stream.activity_id = effort.activity_id
        AND time_stream.type = 'time'
        AND samples.time BETWEEN effort.start_time AND effort.end_time
        AND samples.value BETWEEN 1 AND 300
    ),
    elevation_change = (
      SELECT
        (ARRAY_AGG(samples.value ORDER BY ABS(samples.time - effort.end_time)))[1] -
        (ARRAY_AGG(samples.value ORDER BY ABS(samples.time - effort.start_time)))[1]
      FROM activity_stream AS time_stream
      INNER JOIN activity_stream AS value_stream
        ON value_stream.activity_id = time_stream.activity_id AND value_stream.type = 'altitude'
      CROSS JOIN LATERAL unnest(time_stream.data, value_stream.data) AS samples(time, value)
      WHERE time_stream.activity_id = effort.activity_id
        AND time_stream.type = 'time'
        AND samples.time BETWEEN 0 AND effort.end_time
        AND samples.value BETWEEN -1000 AND 10000
    )
  `.execute(db);

  await sql`
    ALTER TABLE activity_best_effort
      ADD CONSTRAINT activity_best_effort_avg_hr_check CHECK (avg_hr IS NULL OR avg_hr BETWEEN 1 AND 300)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort DROP COLUMN elevation_change`.execute(db);
  await sql`ALTER TABLE activity_best_effort DROP COLUMN avg_hr`.execute(db);
}
