import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE mcp_credential (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      name text NOT NULL,
      kind text NOT NULL CHECK (kind IN ('key', 'oauth')),
      token_hash text NOT NULL UNIQUE,
      refresh_hash text UNIQUE,
      client_id text,
      audience text,
      scopes text[] NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      expires_at timestamptz NOT NULL,
      refresh_expires_at timestamptz,
      revoked_at timestamptz
    );
    CREATE INDEX mcp_credential_user_idx ON mcp_credential(user_id);
    CREATE TABLE mcp_oauth_client (
      id text PRIMARY KEY,
      name text NOT NULL,
      redirect_uris text[] NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE mcp_oauth_code (
      hash text PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      client_id text NOT NULL REFERENCES mcp_oauth_client(id) ON DELETE CASCADE,
      redirect_uri text NOT NULL,
      challenge text NOT NULL,
      audience text NOT NULL,
      scopes text[] NOT NULL,
      expires_at timestamptz NOT NULL
    );
    CREATE TABLE mcp_preference (
      user_id uuid PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      timezone text NOT NULL DEFAULT 'UTC',
      units text NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial'))
    );
    CREATE TABLE mcp_upload (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      checksum text NOT NULL,
      original_name text NOT NULL,
      storage_path text NOT NULL,
      byte_size integer NOT NULL,
      expires_at timestamptz NOT NULL,
      consumed_at timestamptz
    );
    CREATE TABLE mcp_operation (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      credential_id uuid REFERENCES mcp_credential(id) ON DELETE SET NULL,
      kind text NOT NULL,
      idempotency_key text NOT NULL,
      input_hash text NOT NULL,
      result jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(user_id, kind, idempotency_key)
    );
    CREATE TABLE mcp_audit (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      credential_id uuid REFERENCES mcp_credential(id) ON DELETE SET NULL,
      action text NOT NULL,
      target_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX mcp_audit_user_created_idx ON mcp_audit(user_id, created_at DESC);
    ALTER TABLE activity ADD COLUMN revision integer NOT NULL DEFAULT 1;
    CREATE FUNCTION bump_activity_revision() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.revision := OLD.revision + 1; RETURN NEW; END;
    $$;
    CREATE TRIGGER activity_revision BEFORE UPDATE ON activity
      FOR EACH ROW EXECUTE FUNCTION bump_activity_revision();
    CREATE INDEX IF NOT EXISTS activity_owner_started_idx ON activity(user_id, started_at DESC, id DESC);
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER activity_revision ON activity;
    DROP FUNCTION bump_activity_revision();
    ALTER TABLE activity DROP COLUMN revision;
    DROP TABLE mcp_audit, mcp_operation, mcp_upload, mcp_preference, mcp_oauth_code, mcp_oauth_client, mcp_credential;
  `.execute(db);
}
