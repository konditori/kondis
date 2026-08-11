import { Kysely, sql } from 'kysely';

const UNRANKED = 2_147_483_647;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort ALTER COLUMN overall_rank SET DEFAULT ${sql.lit(UNRANKED)}`.execute(db);
  await sql`ALTER TABLE activity_best_effort ALTER COLUMN year_rank SET DEFAULT ${sql.lit(UNRANKED)}`.execute(db);

  // Repair rows that may have retained the old default rank after their refresh request was deduplicated.
  await sql`SELECT kondis_refresh_best_effort_rankings()`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_best_effort ALTER COLUMN overall_rank SET DEFAULT 1`.execute(db);
  await sql`ALTER TABLE activity_best_effort ALTER COLUMN year_rank SET DEFAULT 1`.execute(db);
}
