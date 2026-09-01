import { Kysely, sql } from 'kysely';

// The initial schema omitted several cycling distance types that are part of
// CYCLING_BEST_EFFORTS. Rebuild the check constraint so computed efforts can
// be stored on databases created before this list was complete.
const CYCLING_BEST_EFFORT_TYPES = [
  'longest_ride',
  'biggest_climb',
  'elevation_gain',
  '5_miles',
  '10k',
  '10_miles',
  '20k',
  '30k',
  '40k',
  '50k',
  '80k',
  '50_miles',
  '90k',
  '100k',
  '100_miles',
  '180k',
  'power_5s',
  'power_15s',
  'power_30s',
  'power_1m',
  'power_2m',
  'power_3m',
  'power_5m',
  'power_8m',
  'power_10m',
  'power_15m',
  'power_20m',
  'power_30m',
  'power_45m',
  'power_1h',
  'power_2h',
] as const;

const ALL_BEST_EFFORT_TYPES = [
  '400m',
  '1k',
  'half_mile',
  '1_mile',
  '2_miles',
  '5k',
  '10k',
  '15k',
  '10_miles',
  '20k',
  'half_marathon',
  '30k',
  'marathon',
  '50k',
  ...CYCLING_BEST_EFFORT_TYPES,
] as const;

const constraintName = 'activity_best_effort_type_check';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort DROP CONSTRAINT IF EXISTS ${sql.raw(constraintName)}`.execute(db);
  await sql`
    ALTER TABLE activity_best_effort
    ADD CONSTRAINT ${sql.raw(constraintName)}
    CHECK (type IN (${sql.join(ALL_BEST_EFFORT_TYPES.map((type) => sql.lit(type)))}))
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort DROP CONSTRAINT IF EXISTS ${sql.raw(constraintName)}`.execute(db);
  await sql`
    ALTER TABLE activity_best_effort
    ADD CONSTRAINT ${sql.raw(constraintName)}
    CHECK (type IN ('400m', '1k', 'half_mile', '1_mile', '2_miles', '5k', '10k', '15k', '10_miles',
      '20k', 'half_marathon', '30k', 'marathon', '50k', 'longest_ride', 'biggest_climb', 'elevation_gain',
      '5_miles', '40k', '80k', '50_miles', '90k', '100k', '100_miles', '180k', 'power_5s', 'power_15s',
      'power_30s', 'power_1m', 'power_2m', 'power_3m', 'power_5m', 'power_8m', 'power_10m', 'power_15m',
      'power_20m', 'power_30m', 'power_45m', 'power_1h', 'power_2h'))
  `.execute(db);
}
