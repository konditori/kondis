import { sql } from 'kysely';

import {
  insertBackgroundJobs,
  type CloudflareQueueBinding,
  type CloudflareQueueMessage,
} from 'src/cloudflare/background-job';
import type { QueueName } from 'src/enum';
import { CRON_JOBS, JOB_EXPIRE_SECONDS, JOB_QUEUE } from 'src/jobs/job-semantics';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';

type UnpublishedJob = { id: string; queue: QueueName };

export type CloudQueueBindings = Record<QueueName, CloudflareQueueBinding>;

export const reclaimStaleJobs = async (db: KondisDatabase): Promise<number> => {
  const result = await sql<{ id: string }>`
    UPDATE background_job
    SET state = 'retry',
        start_after = now(),
        published_on = NULL,
        output = ${JSON.stringify({ status: 'retry', message: 'Recovered after an expired worker lease' })}::jsonb
    WHERE state = 'active'
      AND started_on IS NOT NULL
      AND started_on <= now() - (${JOB_EXPIRE_SECONDS} * interval '1 second')
    RETURNING id::text
  `.execute(db);
  return result.rows.length;
};

export const dispatchUnpublishedJobs = async (
  db: KondisDatabase,
  queues: CloudQueueBindings,
  limit = 100,
): Promise<number> => {
  const result = await sql<UnpublishedJob>`
    SELECT id::text, queue
    FROM background_job
    WHERE published_on IS NULL AND start_after <= now() AND state IN ('created', 'retry')
    ORDER BY priority DESC, created_on
    LIMIT ${limit}
  `.execute(db);

  let dispatched = 0;
  for (const job of result.rows) {
    const queue = queues[job.queue];
    if (!queue) {
      throw new Error(`No Cloudflare Queue binding configured for ${job.queue}`);
    }
    const message: CloudflareQueueMessage = { jobId: job.id, version: 1 };
    await queue.send(message);
    await sql`
      UPDATE background_job
      SET published_on = now()
      WHERE id = ${job.id}::uuid AND published_on IS NULL
    `.execute(db);
    dispatched += 1;
  }
  return dispatched;
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
