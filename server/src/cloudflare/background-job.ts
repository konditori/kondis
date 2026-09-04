import { sql } from 'kysely';

import { JOB_QUEUE, JOB_RETRY_DELAY_SECONDS, JOB_RETRY_LIMIT, getJobOptions } from 'src/jobs/job-semantics';
import type { KondisExecutor } from 'src/types';
import type { JobItem } from 'src/types/jobs';

export type CloudflareQueueMessage = { jobId: string; version: number };

export type CloudflareQueueBinding = {
  send: (message: CloudflareQueueMessage) => Promise<void>;
};

export type BackgroundJobRecord = {
  id: string;
  queue: string;
  name: string;
  payload: { name: JobItem['name']; data?: object };
  state: string;
  retry_count: number;
  retry_limit: number;
};

export const insertBackgroundJobs = async (executor: KondisExecutor, items: readonly JobItem[]): Promise<void> => {
  if (items.length === 0) {
    return;
  }

  const values = items.map((item) => {
    const jobOptions = getJobOptions(item);
    return sql`(
      ${JOB_QUEUE[item.name]},
      ${item.name},
      ${JSON.stringify({ name: item.name, data: item.data })}::jsonb,
      'created',
      ${jobOptions.priority ?? 0},
      ${jobOptions.singletonKey ?? null},
      0,
      ${JOB_RETRY_LIMIT},
      now(),
      now()
    )`;
  });

  await sql`
    INSERT INTO background_job
      (queue, name, payload, state, priority, singleton_key, retry_count, retry_limit, start_after, created_on)
    VALUES ${sql.join(values)}
    ON CONFLICT DO NOTHING
  `.execute(executor);
};

export const retryDelaySeconds = (retryCount: number): number => JOB_RETRY_DELAY_SECONDS * 2 ** retryCount;
