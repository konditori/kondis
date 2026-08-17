import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS user_handle_lower_idx`.execute(db);
  await sql`ALTER TABLE "user" DROP COLUMN IF EXISTS handle`.execute(db);
}

export async function down(_db: Kysely<unknown>): Promise<void> {
  // Handles are intentionally not recreated; user ids are the database UUIDs.
}
