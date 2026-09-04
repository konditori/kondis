import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE background_job (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      queue text NOT NULL,
      name text NOT NULL,
      payload jsonb NOT NULL,
      state text NOT NULL DEFAULT 'created'
        CHECK (state IN ('created', 'active', 'retry', 'completed', 'failed', 'dead')),
      priority integer NOT NULL DEFAULT 0,
      singleton_key text,
      retry_count integer NOT NULL DEFAULT 0,
      retry_limit integer NOT NULL DEFAULT 3,
      start_after timestamptz NOT NULL DEFAULT now(),
      created_on timestamptz NOT NULL DEFAULT now(),
      started_on timestamptz,
      completed_on timestamptz,
      output jsonb,
      published_on timestamptz,
      delete_after timestamptz
    )
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX background_job_singleton_idx
      ON background_job (queue, name, singleton_key)
      WHERE state IN ('created', 'retry', 'active') AND singleton_key IS NOT NULL
  `.execute(db);
  await sql`
    CREATE INDEX background_job_claim_idx
      ON background_job (queue, state, start_after, priority DESC, created_on)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE background_job`.execute(db);
}
