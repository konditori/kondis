import { sql } from 'kysely';

import {
  retryDelaySeconds,
  type BackgroundJobRecord,
  type CloudflareQueueMessage,
} from 'src/cloudflare/background-job';
import { JobName, JobStatus } from 'src/enum';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';
import { asErrorMessage } from 'src/utils/misc';

export type CloudflareQueueMessageHandle = {
  body: CloudflareQueueMessage;
  ack: () => void;
  retry: (options?: { delaySeconds?: number }) => void;
};

export type CloudflareQueueBatch = {
  messages: readonly CloudflareQueueMessageHandle[];
};

export type CloudJobHandler = (data: never) => Promise<JobStatus>;
export type CloudJobHandlers = Partial<Record<JobName, CloudJobHandler>>;

const claimJob = async (db: KondisDatabase, jobId: string): Promise<BackgroundJobRecord | undefined> => {
  const result = await sql<BackgroundJobRecord>`
    UPDATE background_job
    SET state = 'active', started_on = COALESCE(started_on, now())
    WHERE id = ${jobId}::uuid
      AND state IN ('created', 'retry')
      AND start_after <= now()
    RETURNING id, queue, name, payload, state, retry_count, retry_limit
  `.execute(db);
  return result.rows[0];
};

const completeJob = async (db: KondisDatabase, jobId: string, status: JobStatus): Promise<void> => {
  await sql`
    UPDATE background_job
    SET state = 'completed', completed_on = now(), output = ${JSON.stringify({ status })}::jsonb
    WHERE id = ${jobId}::uuid AND state = 'active'
  `.execute(db);
};

const retryJob = async (db: KondisDatabase, row: BackgroundJobRecord, error: unknown): Promise<number> => {
  const delaySeconds = retryDelaySeconds(row.retry_count);
  await sql`
    UPDATE background_job
    SET state = 'retry',
        retry_count = retry_count + 1,
        start_after = now() + (${delaySeconds} * interval '1 second'),
        published_on = NULL,
        output = ${JSON.stringify({ status: JobStatus.Failed, message: asErrorMessage(error) })}::jsonb
    WHERE id = ${row.id}::uuid AND state = 'active'
  `.execute(db);
  return delaySeconds;
};

export const handleQueueBatch = async (
  batch: CloudflareQueueBatch,
  db: KondisDatabase,
  handlers: CloudJobHandlers,
): Promise<void> => {
  for (const message of batch.messages) {
    const row = await claimJob(db, message.body.jobId);
    if (!row) {
      message.ack();
      continue;
    }

    const handler = handlers[row.name as JobName];
    if (!handler) {
      const delaySeconds = await retryJob(db, row, new Error(`No Worker handler registered for job ${row.name}`));
      message.retry({ delaySeconds });
      continue;
    }

    try {
      const payload = row.payload as { name: JobItem['name']; data: never };
      const status = await handler(payload.data);
      await completeJob(db, row.id, status);
      message.ack();
    } catch (error) {
      const delaySeconds = await retryJob(db, row, error);
      message.retry({ delaySeconds });
    }
  }
};

export const handleDeadLetterBatch = async (batch: CloudflareQueueBatch, db: KondisDatabase): Promise<void> => {
  for (const message of batch.messages) {
    await sql`
      UPDATE background_job
      SET state = 'dead', completed_on = COALESCE(completed_on, now())
      WHERE id = ${message.body.jobId}::uuid AND state IN ('active', 'retry', 'failed')
    `.execute(db);
    message.ack();
  }
};

export const createPortableWorkerHandlers = (db: KondisDatabase): CloudJobHandlers => ({
  [JobName.AuthCredentialCleanup]: async () => {
    await Promise.all([
      db.deleteFrom('auth_session').where('expires_at', '<=', new Date()).execute(),
      db.deleteFrom('auth_ticket').where('expires_at', '<=', new Date()).execute(),
      db
        .deleteFrom('auth_rate_limit')
        .where('window_started_at', '<=', new Date(Date.now() - 24 * 60 * 60_000))
        .execute(),
    ]);
    return JobStatus.Success;
  },
});
