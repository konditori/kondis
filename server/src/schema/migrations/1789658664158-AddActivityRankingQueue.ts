import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE background_job DROP CONSTRAINT IF EXISTS background_job_queue_routing_check`.execute(db);
  await sql`ALTER TABLE background_job DROP CONSTRAINT IF EXISTS background_job_queue_values_check`.execute(db);

  await sql`
    UPDATE background_job
    SET queue = 'activityRanking'
    WHERE name = 'ActivityBestEffortRank'
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_values_check CHECK (
      queue IN ('activityParsing', 'activityEnrichment', 'activityRanking', 'backgroundTask', 'imageProcessing', 'storage')
    )
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_routing_check CHECK (
      (queue = 'activityParsing' AND name IN ('ActivityParse', 'ActivityManualCreate'))
      OR (queue = 'activityEnrichment' AND name IN (
        'ActivityMetricCompute',
        'ActivityBestEffortCompute',
        'ActivityRouteMatchCompute'
      ))
      OR (queue = 'activityRanking' AND name = 'ActivityBestEffortRank')
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

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE background_job DROP CONSTRAINT IF EXISTS background_job_queue_routing_check`.execute(db);
  await sql`ALTER TABLE background_job DROP CONSTRAINT IF EXISTS background_job_queue_values_check`.execute(db);
  await sql`
    UPDATE background_job
    SET queue = 'activityEnrichment'
    WHERE name = 'ActivityBestEffortRank'
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_queue_values_check CHECK (
      queue IN ('activityParsing', 'activityEnrichment', 'backgroundTask', 'imageProcessing', 'storage')
    )
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
}
