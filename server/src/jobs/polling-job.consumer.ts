import { sql } from 'kysely';

import { nextJobFailure, type BackgroundJobRecord } from 'src/cloudflare/background-job';
import { JobName, JobStatus, QueueName } from 'src/enum';
import type { AnyJobHandlerDescriptor } from 'src/jobs/job-handler';
import {
  CLOUD_JOB_CONSUMER,
  JOB_CONCURRENCY,
  JOB_EXPIRE_SECONDS,
  JOB_QUEUE,
  JOB_RETENTION_SECONDS,
} from 'src/jobs/job-semantics';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';
import { KondisStartupError, asErrorMessage } from 'src/utils/misc';

const MAX_STORED_ERROR_LENGTH = 4096;

type ClaimedJob = Pick<BackgroundJobRecord, 'id' | 'lease_id' | 'name' | 'queue' | 'retry_count' | 'retry_limit'> & {
  payload: { name: JobItem['name']; data: never };
};

export type PollingJobHandler = (data: never) => Promise<JobStatus>;
export type PollingJobHandlers = Partial<Record<JobName, PollingJobHandler>>;
export type PollingJobConsumerOptions = {
  concurrency?: Partial<Record<QueueName, number>>;
  leaseHeartbeatMs?: number;
  pollIntervalMs?: number;
  logger?: Pick<Console, 'error' | 'warn'>;
};

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));
const storedError = (error: unknown): string => asErrorMessage(error).slice(0, MAX_STORED_ERROR_LENGTH);

/**
 * Builds the heavy-job registry for the cloud Node processor. The checks make
 * queue ownership an executable contract instead of relying on composition
 * code to remember which handlers are Worker-safe.
 */
export const createPollingJobHandlers = (descriptors: readonly AnyJobHandlerDescriptor[]): PollingJobHandlers => {
  const handlers: PollingJobHandlers = {};
  const seen = new Map<JobName, string>();

  for (const descriptor of descriptors) {
    const existing = seen.get(descriptor.jobName);
    if (existing) {
      throw new KondisStartupError(
        `Failed to add job handler for ${descriptor.label}. JobName.${descriptor.jobName} is already handled by ${existing}.`,
      );
    }
    seen.set(descriptor.jobName, descriptor.label);

    if (descriptor.queueName !== JOB_QUEUE[descriptor.jobName]) {
      throw new KondisStartupError(
        `Job handler ${descriptor.label} routes ${descriptor.jobName} to ${descriptor.queueName}; shared semantics require ${JOB_QUEUE[descriptor.jobName]}.`,
      );
    }
    const consumer = descriptor.cloudConsumer ?? 'node';
    if (consumer !== CLOUD_JOB_CONSUMER[descriptor.jobName]) {
      throw new KondisStartupError(
        `Job handler ${descriptor.label} assigns ${descriptor.jobName} to the ${consumer} cloud consumer; shared semantics require ${CLOUD_JOB_CONSUMER[descriptor.jobName]}.`,
      );
    }
    if (consumer === 'node') {
      handlers[descriptor.jobName] = descriptor.handler as PollingJobHandler;
    }
  }

  for (const jobName of Object.values(JobName)) {
    if (CLOUD_JOB_CONSUMER[jobName] === 'node' && !handlers[jobName]) {
      throw new KondisStartupError(`Failed to find a Node cloud job handler for JobName.${jobName} ("${jobName}").`);
    }
  }

  return handlers;
};

export const claimNextPollingJob = async (db: KondisDatabase, queue: QueueName): Promise<ClaimedJob | undefined> =>
  db.transaction().execute(async (transaction) => {
    const result = await sql<ClaimedJob>`
      WITH candidate AS (
        SELECT job.id
        FROM background_job AS job
        WHERE job.consumer = 'node'
          AND job.queue = ${queue}
          AND job.state IN ('created', 'retry')
          AND job.start_after <= now()
          AND (
            job.queue NOT IN (${QueueName.ActivityParsing}, ${QueueName.BackgroundTask})
            OR NOT EXISTS (
              SELECT 1
              FROM background_job AS active_job
              WHERE active_job.queue = job.queue AND active_job.state = 'active'
            )
          )
        ORDER BY job.priority DESC, job.created_on
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE background_job AS job
      SET state = 'active',
          started_on = now(),
          completed_on = NULL,
          delete_after = NULL,
          lease_id = gen_random_uuid(),
          lease_expires_at = now() + (${JOB_EXPIRE_SECONDS} * interval '1 second')
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING
        job.id::text,
        job.lease_id::text,
        job.name,
        job.queue,
        job.payload,
        job.retry_count,
        job.retry_limit
    `.execute(transaction);
    return result.rows[0];
  });

export class PollingJobConsumer {
  private running = false;
  private loopPromises: Promise<void>[] = [];
  private onJobRun: ((item: JobItem) => Promise<JobStatus>) | undefined;

  constructor(
    private readonly db: KondisDatabase,
    private readonly handlers: PollingJobHandlers,
    private readonly options: PollingJobConsumerOptions = {},
  ) {}

  startWorkers(onJobRun: (item: JobItem) => Promise<JobStatus>): Promise<void> {
    if (this.running) {
      return Promise.resolve();
    }
    this.onJobRun = onJobRun;
    this.running = true;
    this.loopPromises = Object.values(QueueName).flatMap((queue) =>
      Array.from({ length: this.queueConcurrency(queue) }, () => this.consume(queue)),
    );
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    this.running = false;
    await Promise.all(this.loopPromises);
    this.loopPromises = [];
  }

  async run<T extends JobName>({ name, data }: JobItem & { name: T }): Promise<JobStatus> {
    const handler = this.handlers[name];
    if (!handler) {
      throw new Error(`No Node handler registered for cloud job ${name}`);
    }
    return handler(data as never);
  }

  private queueConcurrency(queue: QueueName): number {
    const configured = this.options.concurrency?.[queue] ?? JOB_CONCURRENCY[queue];
    return Math.max(1, Math.trunc(configured));
  }

  private async consume(queue: QueueName): Promise<void> {
    const pollIntervalMs = this.options.pollIntervalMs ?? 1000;
    while (this.running) {
      try {
        const job = await claimNextPollingJob(this.db, queue);
        if (!job) {
          await sleep(pollIntervalMs);
          continue;
        }
        await this.process(job);
      } catch (error) {
        this.options.logger?.error(`Polling job consumer failed for ${queue}: ${asErrorMessage(error)}`);
        await sleep(pollIntervalMs);
      }
    }
  }

  private async process(job: ClaimedJob): Promise<void> {
    const item = job.payload as JobItem;
    const stopHeartbeat = this.startLeaseHeartbeat(job);
    try {
      let status: JobStatus;
      try {
        status = this.onJobRun ? await this.onJobRun(item) : await this.run(item);
      } catch (error) {
        await this.recordFailure(job, error);
        return;
      }

      const result = await sql<{ id: string }>`
        UPDATE background_job
        SET state = 'completed',
            completed_on = now(),
            output = ${JSON.stringify({ status })}::jsonb,
            delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
            lease_id = NULL,
            lease_expires_at = NULL
        WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
        RETURNING id::text
      `.execute(this.db);
      if (result.rows.length === 0) {
        this.options.logger?.warn(`Polling job ${job.id} completed after losing its lease; result was ignored`);
      }
    } finally {
      stopHeartbeat();
    }
  }

  private async recordFailure(job: ClaimedJob, error: unknown): Promise<void> {
    const transition = nextJobFailure(job.retry_count, job.retry_limit);
    const result = await sql<{ id: string }>`
      UPDATE background_job
      SET state = ${transition.exhausted ? 'failed' : 'retry'},
          retry_count = ${transition.retryCount},
          start_after = now() + (${transition.delaySeconds} * interval '1 second'),
          completed_on = ${transition.exhausted ? sql`now()` : sql`NULL`},
          delete_after = ${
            transition.exhausted ? sql`now() + (${JOB_RETENTION_SECONDS} * interval '1 second')` : sql`NULL`
          },
          lease_id = NULL,
          lease_expires_at = NULL,
          output = ${JSON.stringify({ status: JobStatus.Failed, message: storedError(error) })}::jsonb
      WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
      RETURNING id::text
    `.execute(this.db);
    if (result.rows.length === 0) {
      this.options.logger?.warn(`Polling job ${job.id} failed after losing its lease; failure was ignored`);
      return;
    }
    this.options.logger?.warn(`Polling job ${job.id} failed: ${storedError(error)}`);
  }

  private startLeaseHeartbeat(job: ClaimedJob): () => void {
    const intervalMs = this.options.leaseHeartbeatMs ?? Math.max(1000, (JOB_EXPIRE_SECONDS * 1000) / 3);
    let updating = false;
    const timer = setInterval(() => {
      if (updating) {
        return;
      }
      updating = true;
      void sql`
        UPDATE background_job
        SET lease_expires_at = now() + (${JOB_EXPIRE_SECONDS} * interval '1 second')
        WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
      `
        .execute(this.db)
        .catch((error: unknown) => {
          this.options.logger?.warn(`Could not renew lease for polling job ${job.id}: ${asErrorMessage(error)}`);
        })
        .finally(() => {
          updating = false;
        });
    }, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }
}
