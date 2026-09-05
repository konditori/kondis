import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE auth_bootstrap (
      id boolean PRIMARY KEY DEFAULT true CHECK (id),
      token_hash text NOT NULL CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `.execute(db);
  await sql`
    CREATE TABLE auth_rate_limit (
      key text PRIMARY KEY,
      attempts integer NOT NULL CHECK (attempts > 0),
      window_started_at timestamptz NOT NULL,
      CHECK (length(key) BETWEEN 1 AND 256)
    )
  `.execute(db);
  await sql`CREATE INDEX auth_rate_limit_window_started_at_idx ON auth_rate_limit (window_started_at)`.execute(db);

  await sql`
    CREATE TABLE auth_session (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    )
  `.execute(db);
  await sql`CREATE INDEX auth_session_user_id_idx ON auth_session (user_id)`.execute(db);
  await sql`CREATE INDEX auth_session_expires_at_idx ON auth_session (expires_at)`.execute(db);

  await sql`
    CREATE TABLE auth_ticket (
      token_hash text PRIMARY KEY CHECK (token_hash ~ '^[0-9a-f]{64}$'),
      user_id uuid REFERENCES "user" (id) ON DELETE CASCADE,
      session_id uuid REFERENCES auth_session (id) ON DELETE CASCADE,
      scope text NOT NULL CHECK (scope IN ('initial-setup', 'activity-events', 'job-events')),
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL,
      CHECK (
        (scope = 'initial-setup' AND user_id IS NULL AND session_id IS NULL)
        OR (scope IN ('activity-events', 'job-events') AND user_id IS NOT NULL AND session_id IS NOT NULL)
      )
    )
  `.execute(db);
  await sql`CREATE INDEX auth_ticket_expires_at_idx ON auth_ticket (expires_at)`.execute(db);
  await sql`CREATE INDEX auth_ticket_session_id_idx ON auth_ticket (session_id)`.execute(db);
  await sql`CREATE INDEX auth_ticket_user_id_idx ON auth_ticket (user_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE auth_ticket`.execute(db);
  await sql`DROP TABLE auth_session`.execute(db);
  await sql`DROP TABLE auth_rate_limit`.execute(db);
  await sql`DROP TABLE auth_bootstrap`.execute(db);
}
