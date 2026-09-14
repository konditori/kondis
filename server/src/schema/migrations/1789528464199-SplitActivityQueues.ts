import { Kysely, sql } from 'kysely';

const enrichmentJobs = [
  'ActivityMetricCompute',
  'ActivityBestEffortCompute',
  'ActivityBestEffortRank',
  'ActivityRouteMatchCompute',
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    DECLARE
      constraint_name text;
    BEGIN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'background_job'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%queue%'
          AND pg_get_constraintdef(c.oid) LIKE '%activityParsing%'
      LOOP
        EXECUTE format('ALTER TABLE background_job DROP CONSTRAINT %I', constraint_name);
      END LOOP;
    END
    $$
  `.execute(db);

  await sql`DROP INDEX IF EXISTS background_job_exclusive_queue_idx`.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_values_check CHECK (
      queue IN ('activityParsing', 'activityEnrichment', 'backgroundTask', 'imageProcessing', 'storage')
    )
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD COLUMN IF NOT EXISTS dispatch_token uuid
  `.execute(db);

  await sql`
    UPDATE background_job
    SET queue = 'activityEnrichment'
    WHERE name = ANY(${sql.val(enrichmentJobs)}::text[])
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_routing_check CHECK (
      (queue = 'activityParsing' AND name IN ('ActivityParse', 'ActivityManualCreate'))
      OR (queue = 'activityEnrichment' AND name IN (
        'ActivityMetricCompute',
        'ActivityBestEffortCompute',
        'ActivityBestEffortRank',
        'ActivityRouteMatchCompute'
      ))
      OR (queue = 'backgroundTask' AND name IN (
        'AuthCredentialCleanup',
        'ActivityUpload',
        'ActivityParseQueueAll',
        'ActivityDelete',
        'ActivityImageGenerateQueueAll'
      ))
      OR (queue = 'imageProcessing' AND name IN (
        'ActivityImageIngest',
        'ActivityImageAttach',
        'ActivityImageGenerateThumbnails',
        'UserAvatarUpload'
      ))
      OR (queue = 'storage' AND name IN ('FileDelete', 'TemporaryFileCleanup'))
    )
  `.execute(db);

  // Repair counters written by the pre-atomic implementation once while the
  // migration has an explicit, consistent snapshot.
  await sql`
    UPDATE takeout_import AS import
    SET uploaded = counts.uploaded,
        processed = counts.processed,
        failed = counts.failed,
        duplicates = counts.duplicates
    FROM (
      SELECT
        import_id,
        count(*) FILTER (WHERE status <> 'pending')::int AS uploaded,
        count(*) FILTER (WHERE status IN ('completed', 'failed', 'duplicate'))::int AS processed,
        count(*) FILTER (WHERE status = 'failed')::int AS failed,
        count(*) FILTER (WHERE status = 'duplicate')::int AS duplicates
      FROM takeout_import_item
      GROUP BY import_id
    ) AS counts
    WHERE import.id = counts.import_id
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE background_job DROP CONSTRAINT IF EXISTS background_job_queue_routing_check`.execute(db);
  await sql`ALTER TABLE background_job DROP CONSTRAINT IF EXISTS background_job_queue_values_check`.execute(db);
  await sql`
    UPDATE background_job
    SET queue = 'activityParsing'
    WHERE name = ANY(${sql.val(enrichmentJobs)}::text[])
  `.execute(db);
  await sql`ALTER TABLE background_job DROP COLUMN IF EXISTS dispatch_token`.execute(db);
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS background_job_exclusive_queue_idx
      ON background_job (queue)
      WHERE state = 'active' AND queue IN ('activityParsing', 'backgroundTask')
  `.execute(db);
  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_values_check CHECK (
      queue IN ('activityParsing', 'backgroundTask', 'imageProcessing', 'storage')
    )
  `.execute(db);
  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_routing_check CHECK (
      (queue = 'activityParsing' AND name IN (
        'ActivityMetricCompute',
        'ActivityBestEffortCompute',
        'ActivityBestEffortRank',
        'ActivityRouteMatchCompute',
        'ActivityParse',
        'ActivityManualCreate'
      ))
      OR (queue = 'backgroundTask' AND name IN (
        'AuthCredentialCleanup',
        'ActivityUpload',
        'ActivityParseQueueAll',
        'ActivityDelete',
        'ActivityImageGenerateQueueAll'
      ))
      OR (queue = 'imageProcessing' AND name IN (
        'ActivityImageIngest',
        'ActivityImageAttach',
        'ActivityImageGenerateThumbnails',
        'UserAvatarUpload'
      ))
      OR (queue = 'storage' AND name IN ('FileDelete', 'TemporaryFileCleanup'))
    )
  `.execute(db);
}
