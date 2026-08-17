import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE "user" ADD COLUMN avatar_path text`.execute(db);
  await sql`ALTER TABLE "user" ADD COLUMN avatar_mime_type text`.execute(db);
  await sql`ALTER TABLE "user" ADD COLUMN avatar_size integer`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE "user" DROP COLUMN avatar_size`.execute(db);
  await sql`ALTER TABLE "user" DROP COLUMN avatar_mime_type`.execute(db);
  await sql`ALTER TABLE "user" DROP COLUMN avatar_path`.execute(db);
}
