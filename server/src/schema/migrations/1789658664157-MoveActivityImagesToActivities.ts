import { Kysely, sql } from 'kysely';
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_image ADD COLUMN activity_id uuid`.execute(db);
  await sql`
    UPDATE activity_image
    SET activity_id = activity.id
    FROM activity
    WHERE activity.upload_id = activity_image.upload_id
  `.execute(db);
  await sql`ALTER TABLE activity_image ALTER COLUMN activity_id SET NOT NULL`.execute(db);
  await sql`
    ALTER TABLE activity_image
    ADD CONSTRAINT activity_image_activity_id_fkey
    FOREIGN KEY (activity_id) REFERENCES activity (id) ON DELETE CASCADE
  `.execute(db);
  await sql`
    ALTER TABLE activity_image
    ADD CONSTRAINT activity_image_activity_id_checksum_key UNIQUE (activity_id, checksum)
  `.execute(db);
  await sql`DROP INDEX IF EXISTS activity_image_upload_order_idx`.execute(db);
  await sql`ALTER TABLE activity_image DROP CONSTRAINT IF EXISTS activity_image_upload_id_checksum_key`.execute(db);
  await sql`ALTER TABLE activity_image DROP COLUMN upload_id`.execute(db);
  await sql`
    CREATE INDEX activity_image_activity_order_idx
    ON activity_image (activity_id, sort_order, created_at)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity_image ADD COLUMN upload_id uuid`.execute(db);
  await sql`
    UPDATE activity_image
    SET upload_id = activity.upload_id
    FROM activity
    WHERE activity.id = activity_image.activity_id
  `.execute(db);
  await sql`ALTER TABLE activity_image ALTER COLUMN upload_id SET NOT NULL`.execute(db);
  await sql`
    ALTER TABLE activity_image
    ADD CONSTRAINT activity_image_upload_id_fkey
    FOREIGN KEY (upload_id) REFERENCES upload (id) ON DELETE CASCADE
  `.execute(db);
  await sql`
    ALTER TABLE activity_image
    ADD CONSTRAINT activity_image_upload_id_checksum_key UNIQUE (upload_id, checksum)
  `.execute(db);
  await sql`DROP INDEX IF EXISTS activity_image_activity_order_idx`.execute(db);
  await sql`ALTER TABLE activity_image DROP CONSTRAINT IF EXISTS activity_image_activity_id_checksum_key`.execute(db);
  await sql`ALTER TABLE activity_image DROP CONSTRAINT IF EXISTS activity_image_activity_id_fkey`.execute(db);
  await sql`ALTER TABLE activity_image DROP COLUMN activity_id`.execute(db);
  await sql`
    CREATE INDEX activity_image_upload_order_idx
    ON activity_image (upload_id, sort_order, created_at)
  `.execute(db);
}
