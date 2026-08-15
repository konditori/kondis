import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
  await sql`
    CREATE INDEX activity_name_trgm_idx
      ON activity USING GIN (name gin_trgm_ops)
  `.execute(db);
  await sql`
    CREATE INDEX activity_description_trgm_idx
      ON activity USING GIN (description gin_trgm_ops)
  `.execute(db);
  await sql`
    CREATE INDEX activity_sport_trgm_idx
      ON activity USING GIN (sport gin_trgm_ops)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS activity_sport_trgm_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS activity_description_trgm_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS activity_name_trgm_idx`.execute(db);
}
