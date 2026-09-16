import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE takeout_import_item ADD COLUMN staged_images jsonb NOT NULL DEFAULT '[]'::jsonb`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE takeout_import_item DROP COLUMN staged_images`.execute(db);
}
