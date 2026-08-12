import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE activity
      ADD COLUMN metrics_computed_at timestamptz,
      ADD COLUMN best_efforts_computed_at timestamptz,
      ADD COLUMN route_matches_computed_at timestamptz
  `.execute(db);

  await sql`
    UPDATE activity
    SET
      metrics_computed_at = now(),
      best_efforts_computed_at = now(),
      route_matches_computed_at = now()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE activity
      DROP COLUMN route_matches_computed_at,
      DROP COLUMN best_efforts_computed_at,
      DROP COLUMN metrics_computed_at
  `.execute(db);
}
