import { Kysely, sql } from 'kysely';
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`CREATE TABLE "user" (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, name text NOT NULL, password_hash text NOT NULL, role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`.execute(db);
  await sql`CREATE TRIGGER user_set_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()`.execute(db);
  await sql`ALTER TABLE upload ADD COLUMN user_id uuid REFERENCES "user" (id) ON DELETE CASCADE`.execute(db);
  await sql`ALTER TABLE activity ADD COLUMN user_id uuid REFERENCES "user" (id) ON DELETE CASCADE`.execute(db);
  await sql`ALTER TABLE upload DROP CONSTRAINT upload_checksum_key`.execute(db);
  await sql`CREATE UNIQUE INDEX upload_user_checksum_idx ON upload (user_id, checksum)`.execute(db);
  await sql`CREATE INDEX activity_user_started_at_idx ON activity (user_id, started_at DESC)`.execute(db);
}
export async function down(db: Kysely<unknown>): Promise<void> { await sql`ALTER TABLE activity DROP COLUMN user_id`.execute(db); await sql`ALTER TABLE upload DROP COLUMN user_id`.execute(db); await sql`DROP TABLE "user"`.execute(db); }
