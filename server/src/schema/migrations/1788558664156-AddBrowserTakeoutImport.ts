import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE takeout_import_item (
      import_id uuid NOT NULL REFERENCES takeout_import (id) ON DELETE CASCADE,
      item_key text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('activity', 'manual')),
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'uploading', 'queued', 'completed', 'failed', 'duplicate')),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (import_id, item_key)
    )
  `.execute(db);
  await sql`
    CREATE TRIGGER takeout_import_item_set_updated_at BEFORE UPDATE ON takeout_import_item
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);
  await sql`CREATE INDEX takeout_import_item_status_idx ON takeout_import_item (import_id, status)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE takeout_import_item`.execute(db);
}
