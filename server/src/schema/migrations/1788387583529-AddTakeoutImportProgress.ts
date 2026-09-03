import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE takeout_import (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
      total integer,
      processed integer NOT NULL DEFAULT 0,
      failed integer NOT NULL DEFAULT 0,
      duplicates integer NOT NULL DEFAULT 0,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (total IS NULL OR total >= 0),
      CHECK (processed >= 0),
      CHECK (failed >= 0),
      CHECK (duplicates >= 0)
    )
  `.execute(db);

  await sql`
    CREATE TRIGGER takeout_import_set_updated_at BEFORE UPDATE ON takeout_import
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);
  await sql`CREATE INDEX takeout_import_user_created_at_idx ON takeout_import (user_id, created_at DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE takeout_import`.execute(db);
}
