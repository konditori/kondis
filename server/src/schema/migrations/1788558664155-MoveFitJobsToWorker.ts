import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    DO $$
    DECLARE
      ownership_constraint_names text[];
    BEGIN
      SELECT array_agg(c.conname)
      INTO ownership_constraint_names
      FROM pg_constraint c
      WHERE c.conrelid = 'background_job'::regclass
        AND c.contype = 'c'
        AND regexp_replace(
          pg_get_constraintdef(c.oid),
          '[[:space:]()]|::text',
          '',
          'g'
        ) = 'CHECKconsumer=''worker''ANDname=''AuthCredentialCleanup''ORconsumer=''node''ANDname<>''AuthCredentialCleanup''';

      IF coalesce(cardinality(ownership_constraint_names), 0) <> 1 THEN
        RAISE EXCEPTION 'Expected exactly one legacy background_job ownership constraint';
      END IF;

      EXECUTE format(
        'ALTER TABLE background_job DROP CONSTRAINT %I',
        ownership_constraint_names[1]
      );
    END
    $$
  `.execute(db);

  await sql`
    UPDATE background_job
    SET consumer = 'worker',
      published_on = CASE
        WHEN state IN ('created', 'retry') THEN NULL
        ELSE published_on
      END
    WHERE name IN (
      'ActivityUpload',
      'ActivityParse',
      'ActivityMetricCompute',
      'ActivityBestEffortCompute',
      'ActivityBestEffortRank',
      'ActivityRouteMatchCompute'
    )
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_consumer_ownership_check CHECK (
      (
        consumer = 'worker'
        AND name IN (
          'AuthCredentialCleanup',
          'ActivityUpload',
          'ActivityParse',
          'ActivityMetricCompute',
          'ActivityBestEffortCompute',
          'ActivityBestEffortRank',
          'ActivityRouteMatchCompute'
        )
      )
      OR (
        consumer = 'node'
        AND name NOT IN (
          'AuthCredentialCleanup',
          'ActivityUpload',
          'ActivityParse',
          'ActivityMetricCompute',
          'ActivityBestEffortCompute',
          'ActivityBestEffortRank',
          'ActivityRouteMatchCompute'
        )
      )
    )
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE background_job
    DROP CONSTRAINT background_job_consumer_ownership_check
  `.execute(db);

  await sql`
    UPDATE background_job
    SET consumer = 'node'
    WHERE name IN (
      'ActivityUpload',
      'ActivityParse',
      'ActivityMetricCompute',
      'ActivityBestEffortCompute',
      'ActivityBestEffortRank',
      'ActivityRouteMatchCompute'
    )
  `.execute(db);

  await sql`
    ALTER TABLE background_job
    ADD CONSTRAINT background_job_consumer_ownership_check CHECK (
      (consumer = 'worker' AND name = 'AuthCredentialCleanup')
      OR (consumer = 'node' AND name <> 'AuthCredentialCleanup')
    )
  `.execute(db);
}
