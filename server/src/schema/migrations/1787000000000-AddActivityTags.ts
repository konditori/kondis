import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE activity
      ADD COLUMN tags text[] NOT NULL DEFAULT '{}'
  `.execute(db);
  await sql`
    ALTER TABLE activity
      ADD CONSTRAINT activity_tags_check CHECK (
        tags <@ ARRAY['race','long_run','commute','workout','competition','recovery','with_pet','with_kid','for_a_cause','bad_gps']::text[]
      )
  `.execute(db);
  await sql`CREATE INDEX activity_tags_idx ON activity USING GIN (tags)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP INDEX IF EXISTS activity_tags_idx`.execute(db);
  await sql`ALTER TABLE activity DROP CONSTRAINT IF EXISTS activity_tags_check`.execute(db);
  await sql`ALTER TABLE activity DROP COLUMN tags`.execute(db);
}
