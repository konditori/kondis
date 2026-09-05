import { sql } from 'kysely';

import { insertBackgroundJobs } from 'src/cloudflare/background-job';
import type { QueueName } from 'src/enum';
import { CRON_JOBS, JOB_QUEUE, JOB_RETENTION_SECONDS, JOB_RETRY_DELAY_SECONDS } from 'src/jobs/job-semantics';
import {
  JOB_DELIVERY_MESSAGE_VERSION,
  type JobDeliveryEnvelope,
  type JobPublisherPort,
} from 'src/ports/job-transport.port';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';

const MAX_DISPATCH_BATCH_SIZE = 100;
const MAX_DISPATCH_BATCHES_PER_INVOCATION = 10;
const PUBLISHED_MESSAGE_TIMEOUT_SECONDS = 5 * 60;

type UnpublishedJob = { id: string; queue: QueueName };

export const reclaimStaleJobs = async (db: KondisDatabase): Promise<number> => {
  const result = await sql<{ id: string }>`
    UPDATE background_job
    SET state = CASE WHEN retry_count + 1 > retry_limit THEN 'failed' ELSE 'retry' END,
        retry_count = retry_count + 1,
        start_after = now() + (${JOB_RETRY_DELAY_SECONDS} * power(2, retry_count) * interval '1 second'),
        completed_on = CASE WHEN retry_count + 1 > retry_limit THEN now() ELSE NULL END,
        published_on = NULL,
        delete_after = CASE
          WHEN retry_count + 1 > retry_limit
            THEN now() + (${JOB_RETENTION_SECONDS} * interval '1 second')
          ELSE NULL
        END,
        lease_id = NULL,
        lease_expires_at = NULL,
        output = jsonb_build_object(
          'status', 'failed',
          'message', CASE
            WHEN retry_count + 1 > retry_limit THEN 'Job lease expired; retry limit exhausted'
            ELSE 'Recovered after an expired job lease'
          END
        )
    WHERE state = 'active' AND lease_expires_at <= now()
    RETURNING id::text
  `.execute(db);
  return result.rows.length;
};

/**
 * A confirmed Queue write should arrive quickly. Resetting an old publication
 * marker is the final crash-window backstop for a lost or misrouted message;
 * duplicate deliveries remain safe because claiming is conditional.
 */
export const recoverOrphanedPublishedJobs = async (db: KondisDatabase): Promise<number> => {
  const result = await sql<{ id: string }>`
    UPDATE background_job
    SET published_on = NULL
    WHERE consumer = 'worker'
      AND state IN ('created', 'retry')
      AND published_on <= now() - (${PUBLISHED_MESSAGE_TIMEOUT_SECONDS} * interval '1 second')
    RETURNING id::text
  `.execute(db);
  return result.rows.length;
};

export const purgeExpiredJobs = async (db: KondisDatabase): Promise<number> => {
  const result = await sql<{ id: string }>`
    DELETE FROM background_job
    WHERE delete_after <= now() AND state IN ('completed', 'failed', 'dead')
    RETURNING id::text
  `.execute(db);
  return result.rows.length;
};

export const dispatchUnpublishedJobs = async (
  db: KondisDatabase,
  publisher: JobPublisherPort,
  limit = MAX_DISPATCH_BATCH_SIZE,
): Promise<number> => {
  const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : MAX_DISPATCH_BATCH_SIZE;
  const batchLimit = Math.max(1, Math.min(requestedLimit, MAX_DISPATCH_BATCH_SIZE));
  const result = await sql<UnpublishedJob>`
    SELECT id::text, queue
    FROM background_job
    WHERE consumer = 'worker'
      AND published_on IS NULL
      AND start_after <= now()
      AND state IN ('created', 'retry')
    ORDER BY priority DESC, created_on
    LIMIT ${batchLimit}
  `.execute(db);

  const byQueue = new Map<QueueName, UnpublishedJob[]>();
  for (const job of result.rows) {
    const jobs = byQueue.get(job.queue) ?? [];
    jobs.push(job);
    byQueue.set(job.queue, jobs);
  }

  let dispatched = 0;
  for (const [queueName, jobs] of byQueue) {
    const messages = jobs.map(({ id }): JobDeliveryEnvelope => ({
      jobId: id,
      queue: queueName,
      version: JOB_DELIVERY_MESSAGE_VERSION,
    }));
    await publisher.publishBatch(queueName, messages);

    const ids = jobs.map(({ id }) => id);
    await sql`
      UPDATE background_job
      SET published_on = now()
      WHERE id = ANY(${sql.val(ids)}::uuid[])
        AND published_on IS NULL
        AND state IN ('created', 'retry')
        AND start_after <= now()
    `.execute(db);
    dispatched += jobs.length;
  }
  return dispatched;
};

export const drainUnpublishedJobs = async (db: KondisDatabase, publisher: JobPublisherPort): Promise<number> => {
  let total = 0;
  for (let batch = 0; batch < MAX_DISPATCH_BATCHES_PER_INVOCATION; batch += 1) {
    const dispatched = await dispatchUnpublishedJobs(db, publisher);
    total += dispatched;
    if (dispatched < MAX_DISPATCH_BATCH_SIZE) {
      break;
    }
  }
  return total;
};

export const enqueueScheduledJob = async (db: KondisDatabase, item: JobItem): Promise<void> => {
  await insertBackgroundJobs(db, [item]);
};

export const runScheduledCron = async (db: KondisDatabase, cron: string): Promise<boolean> => {
  const schedule = CRON_JOBS.find((candidate) => candidate.cron === cron);
  if (!schedule) {
    return false;
  }
  await enqueueScheduledJob(db, schedule.item);
  return true;
};

export const queueForJob = (item: JobItem): QueueName => JOB_QUEUE[item.name];
