import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE activity_image (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      upload_id uuid NOT NULL REFERENCES upload (id) ON DELETE CASCADE,
      checksum text NOT NULL,
      original_name text NOT NULL,
      caption text,
      sort_order integer NOT NULL DEFAULT 0,
      mime_type text,
      byte_size bigint,
      width integer,
      height integer,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
      error text,
      processing_version integer NOT NULL DEFAULT 1,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (upload_id, checksum)
    )
  `.execute(db);

  await sql`
    CREATE TABLE activity_image_file (
      image_id uuid NOT NULL REFERENCES activity_image (id) ON DELETE CASCADE,
      variant text NOT NULL CHECK (variant IN ('original', 'thumbnail', 'preview')),
      storage_path text NOT NULL,
      mime_type text NOT NULL,
      byte_size bigint NOT NULL,
      width integer,
      height integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (image_id, variant),
      UNIQUE (storage_path)
    )
  `.execute(db);

  await sql`CREATE INDEX activity_image_upload_order_idx ON activity_image (upload_id, sort_order, created_at)`.execute(
    db,
  );
  await sql`CREATE INDEX activity_image_status_idx ON activity_image (status)`.execute(db);
  await sql`
    CREATE TRIGGER activity_image_set_updated_at BEFORE UPDATE ON activity_image
      FOR EACH ROW EXECUTE FUNCTION kondis_set_updated_at()
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE activity_image_file`.execute(db);
  await sql`DROP TABLE activity_image`.execute(db);
}
