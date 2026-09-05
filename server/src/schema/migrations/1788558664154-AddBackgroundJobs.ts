import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE background_job (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      queue text NOT NULL,
      name text NOT NULL,
      payload jsonb NOT NULL,
      consumer text NOT NULL CHECK (consumer IN ('node', 'worker')),
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
      delete_after timestamptz,
      lease_id uuid,
      lease_expires_at timestamptz,
      CHECK (queue IN ('activityParsing', 'backgroundTask', 'imageProcessing', 'storage')),
      CHECK (name IN (
        'AuthCredentialCleanup',
        'ActivityUpload',
        'ActivityMetricCompute',
        'ActivityBestEffortCompute',
        'ActivityBestEffortRank',
        'ActivityRouteMatchCompute',
        'ActivityParse',
        'ActivityManualCreate',
        'ActivityParseQueueAll',
        'ActivityDelete',
        'ActivityImageIngest',
        'ActivityImageAttach',
        'ActivityImageGenerateThumbnails',
        'ActivityImageGenerateQueueAll',
        'LagomTakeoutImport',
        'UserAvatarUpload',
        'FileDelete',
        'TemporaryFileCleanup'
      )),
      CHECK (jsonb_typeof(payload) = 'object' AND payload ->> 'name' = name),
      CHECK (
        (consumer = 'worker' AND name = 'AuthCredentialCleanup')
        OR (consumer = 'node' AND name <> 'AuthCredentialCleanup')
      ),
      CHECK (
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
          'ActivityImageGenerateQueueAll',
          'LagomTakeoutImport'
        ))
        OR (queue = 'imageProcessing' AND name IN (
          'ActivityImageIngest',
          'ActivityImageAttach',
          'ActivityImageGenerateThumbnails',
          'UserAvatarUpload'
        ))
        OR (queue = 'storage' AND name IN ('FileDelete', 'TemporaryFileCleanup'))
      ),
      CHECK (retry_count >= 0 AND retry_limit >= 0),
      CHECK ((state = 'active') = (lease_id IS NOT NULL AND lease_expires_at IS NOT NULL)),
      CHECK ((state IN ('completed', 'failed', 'dead')) = (completed_on IS NOT NULL)),
      CHECK ((state IN ('completed', 'failed', 'dead')) = (delete_after IS NOT NULL))
    )
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX background_job_singleton_idx
      ON background_job (queue, name, singleton_key)
      WHERE state IN ('created', 'retry', 'active') AND singleton_key IS NOT NULL
  `.execute(db);
  await sql`
    CREATE INDEX background_job_claim_idx
      ON background_job (consumer, queue, state, start_after, priority DESC, created_on)
      WHERE state IN ('created', 'retry')
  `.execute(db);
  await sql`
    CREATE INDEX background_job_dispatch_idx
      ON background_job (start_after, priority DESC, created_on)
      WHERE consumer = 'worker' AND state IN ('created', 'retry') AND published_on IS NULL
  `.execute(db);
  await sql`
    CREATE INDEX background_job_lease_idx
      ON background_job (lease_expires_at)
      WHERE state = 'active'
  `.execute(db);
  await sql`
    CREATE INDEX background_job_retention_idx
      ON background_job (delete_after)
      WHERE delete_after IS NOT NULL
  `.execute(db);
  await sql`
    CREATE UNIQUE INDEX background_job_exclusive_queue_idx
      ON background_job (queue)
      WHERE state = 'active' AND queue IN ('activityParsing', 'backgroundTask')
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE background_job`.execute(db);
}
