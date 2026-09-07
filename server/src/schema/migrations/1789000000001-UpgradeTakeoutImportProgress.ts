import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE takeout_import
      ADD COLUMN IF NOT EXISTS uploaded integer NOT NULL DEFAULT 0
  `.execute(db);

  await sql`
    DO $$
    DECLARE
      constraint_name text;
    BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'takeout_import'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%status%'
      LOOP
        EXECUTE format('ALTER TABLE takeout_import DROP CONSTRAINT %I', constraint_name);
      END LOOP;
    END
    $$
  `.execute(db);

  await sql`UPDATE takeout_import SET status = 'uploading' WHERE status = 'queued'`.execute(db);
  await sql`
    ALTER TABLE takeout_import
    ADD CONSTRAINT takeout_import_status_check CHECK (
      status IN ('scanning', 'uploading', 'processing', 'completed', 'failed', 'cancelled')
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE takeout_import DROP CONSTRAINT IF EXISTS takeout_import_status_check`.execute(db);
  await sql`
    ALTER TABLE takeout_import
    ADD CONSTRAINT takeout_import_status_check CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
  `.execute(db);
  await sql`ALTER TABLE takeout_import DROP COLUMN IF EXISTS uploaded`.execute(db);
}