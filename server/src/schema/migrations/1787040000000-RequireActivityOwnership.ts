import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Orphan rows predate authentication and have no trustworthy owner. Do not
  // silently transfer them to whichever administrator happens to be created next.
  // Manual imports did record their owner on the upload, so preserve those rows.
  await sql`UPDATE activity
    SET user_id = upload.user_id
    FROM upload
    WHERE activity.upload_id = upload.id
      AND activity.user_id IS NULL
      AND upload.user_id IS NOT NULL`.execute(db);
  await sql`DELETE FROM upload WHERE user_id IS NULL`.execute(db);
  await sql`ALTER TABLE upload ALTER COLUMN user_id SET NOT NULL`.execute(db);
  await sql`ALTER TABLE activity ALTER COLUMN user_id SET NOT NULL`.execute(db);
  await sql`UPDATE live_workout SET share_token_hash = NULL, share_expires_at = NULL WHERE share_expires_at IS NULL`.execute(
    db,
  );
  await sql`ALTER TABLE live_workout ADD CONSTRAINT live_workout_share_expiry_check
    CHECK ((share_token_hash IS NULL) = (share_expires_at IS NULL))`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE activity ALTER COLUMN user_id DROP NOT NULL`.execute(db);
  await sql`ALTER TABLE upload ALTER COLUMN user_id DROP NOT NULL`.execute(db);
  await sql`ALTER TABLE live_workout DROP CONSTRAINT live_workout_share_expiry_check`.execute(db);
}
