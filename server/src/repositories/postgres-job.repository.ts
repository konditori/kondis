import { sql } from 'kysely';

import { JobRepository } from 'src/contracts/job.repository';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { UnsupportedOperationError } from 'src/errors';
import {
  CLOUD_JOB_CONSUMER,
  JOB_EXPIRE_SECONDS,
  JOB_QUEUE,
  JOB_RETENTION_SECONDS,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  getJobOptions,
  type CloudJobConsumer,
  type JobFailureTransition,
} from 'src/jobs/job-semantics';
import type { KondisDatabase, KondisExecutor, KondisTransaction } from 'src/types';
import type { JobCounts, JobHistoryEntry, JobHistoryStatus, JobItem } from 'src/types/jobs';

type CloudJobRow = {
  id: string;
  queue: string;
  name: string;
  payload: { name: JobName; data?: object };
  state: string;
  retry_count: number;
  created_on: Date;
  started_on: Date | null;
  completed_on: Date | null;
  output: unknown;
};

type CloudJobCountsRow = Omit<JobCounts, 'ready'> & { queue: QueueName };

export type ClaimedJob = {
  id: string;
  queue: QueueName;
  name: string;
  payload: { name: JobItem['name']; data?: object };
  state: string;
  retry_count: number;
  retry_limit: number;
  consumer: CloudJobConsumer;
  lease_id: string;
};
export type DispatchClaim = { id: string; queue: QueueName; dispatch_token: string };
export type ReclaimedJob = { id: string; payload: { data?: object }; exhausted: boolean };

/**
 * Owns the custom job table used by both cloud Workers and Node processors.
 */
export class PostgresJobRepository extends JobRepository {
  constructor(private readonly db: KondisDatabase) {
    super();
  }

  async queue(item: JobItem, options: { transaction?: KondisTransaction } = {}): Promise<void> {
    await this.queueAll([item], options);
  }

  async queueAll(items: JobItem[], options: { transaction?: KondisTransaction } = {}): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const executor: KondisExecutor = options.transaction ?? this.db;
    await this.insert(items, executor);
  }

  async insert(items: readonly JobItem[], executor: KondisExecutor = this.db): Promise<void> {
    if (items.length === 0) {
      return;
    }
    const values = items.map((item) => {
      const options = getJobOptions(item);
      const singletonKey =
        item.name === JobName.ActivityUpload ? `${item.name}:${item.data.storagePath}` : options.singletonKey;
      return sql`(
        ${JOB_QUEUE[item.name]}, ${item.name}, ${JSON.stringify({ name: item.name, data: item.data })}::jsonb,
        ${CLOUD_JOB_CONSUMER[item.name]}, 'created', ${options.priority ?? 0}, ${singletonKey ?? null},
        0, ${JOB_RETRY_LIMIT}, now(), now()
      )`;
    });
    await sql`
      INSERT INTO background_job
        (queue, name, payload, consumer, state, priority, singleton_key, retry_count, retry_limit, start_after, created_on)
      VALUES ${sql.join(values)}
      ON CONFLICT DO NOTHING
    `.execute(executor);
  }

  async claimForDispatch(limit: number): Promise<DispatchClaim[]> {
    const result = await sql<DispatchClaim>`
      WITH candidates AS (
        SELECT id FROM background_job
        WHERE consumer = 'worker' AND published_on IS NULL AND start_after <= now()
          AND state IN ('created', 'retry')
        ORDER BY priority DESC, created_on
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE background_job AS job
      SET published_on = now(), dispatch_token = gen_random_uuid()
      FROM candidates WHERE job.id = candidates.id
      RETURNING job.id::text, job.queue, job.dispatch_token::text
    `.execute(this.db);
    return result.rows;
  }

  async releaseDispatchClaims(jobs: readonly DispatchClaim[]): Promise<void> {
    await sql`
      UPDATE background_job SET published_on = NULL, dispatch_token = NULL
      WHERE id = ANY(${sql.val(jobs.map(({ id }) => id))}::uuid[])
        AND dispatch_token = ANY(${sql.val(jobs.map(({ dispatch_token }) => dispatch_token))}::uuid[])
        AND state IN ('created', 'retry')
    `.execute(this.db);
  }

  async claimDeliveredJob(jobId: string, queue: QueueName): Promise<ClaimedJob | undefined> {
    const result = await sql<ClaimedJob>`
      UPDATE background_job AS job
      SET state = 'active', started_on = now(), completed_on = NULL, delete_after = NULL,
          lease_id = gen_random_uuid(), lease_expires_at = now() + (${JOB_EXPIRE_SECONDS} * interval '1 second')
      WHERE job.id = ${jobId}::uuid AND job.queue = ${queue} AND job.consumer = 'worker'
        AND job.state IN ('created', 'retry') AND job.start_after <= now()
      RETURNING id::text, queue, name, payload, state, retry_count, retry_limit, consumer, lease_id::text
    `.execute(this.db);
    return result.rows[0];
  }

  async claimNextJob(
    queue: QueueName,
    consumers: readonly CloudJobConsumer[] = ['node'],
  ): Promise<ClaimedJob | undefined> {
    return this.db.transaction().execute(async (transaction) => {
      const result = await sql<ClaimedJob>`
        WITH candidate AS (
          SELECT job.id FROM background_job AS job
          WHERE job.consumer IN (${sql.join(
            consumers.map((consumer) => sql`${consumer}`),
            sql`, `,
          )})
            AND job.queue = ${queue} AND job.state IN ('created', 'retry') AND job.start_after <= now()
          ORDER BY job.priority DESC, job.created_on
          LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        UPDATE background_job AS job
        SET state = 'active', started_on = now(), completed_on = NULL, delete_after = NULL,
            lease_id = gen_random_uuid(), lease_expires_at = now() + (${JOB_EXPIRE_SECONDS} * interval '1 second')
        FROM candidate WHERE job.id = candidate.id
        RETURNING job.id::text, job.lease_id::text, job.name, job.queue, job.payload,
          job.retry_count, job.retry_limit, job.consumer, job.state
      `.execute(transaction);
      return result.rows[0];
    });
  }

  async releaseUnclaimedDelivery(jobId: string, queue: QueueName): Promise<void> {
    await sql`
      UPDATE background_job SET published_on = NULL, dispatch_token = NULL
      WHERE id = ${jobId}::uuid AND queue = ${queue} AND consumer = 'worker' AND state IN ('created', 'retry')
    `.execute(this.db);
  }

  async complete(job: ClaimedJob, status: JobStatus): Promise<boolean> {
    const result = await sql<{ id: string }>`
      UPDATE background_job
      SET state = 'completed', completed_on = now(), output = ${JSON.stringify({ status })}::jsonb,
          delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
          lease_id = NULL, lease_expires_at = NULL, dispatch_token = NULL
      WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
      RETURNING id::text
    `.execute(this.db);
    return result.rows.length === 1;
  }

  async recordFailure(
    job: ClaimedJob,
    transition: JobFailureTransition,
    message: string,
    releasePublication: boolean,
  ): Promise<boolean> {
    const result = await sql<{ id: string }>`
      UPDATE background_job
      SET state = ${transition.exhausted ? 'failed' : 'retry'}, retry_count = ${transition.retryCount},
          start_after = now() + (${transition.delaySeconds} * interval '1 second'),
          completed_on = ${transition.exhausted ? sql`now()` : sql`NULL`},
          published_on = ${releasePublication && !transition.exhausted ? sql`NULL` : sql`published_on`},
          delete_after = ${transition.exhausted ? sql`now() + (${JOB_RETENTION_SECONDS} * interval '1 second')` : sql`NULL`},
          lease_id = NULL, lease_expires_at = NULL, dispatch_token = NULL,
          output = ${JSON.stringify({ status: JobStatus.Failed, message })}::jsonb
      WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
      RETURNING id::text
    `.execute(this.db);
    return result.rows.length === 1;
  }

  async failPermanently(job: ClaimedJob, message: string): Promise<void> {
    await sql`
      UPDATE background_job
      SET state = 'failed', completed_on = now(),
          delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
          lease_id = NULL, lease_expires_at = NULL, dispatch_token = NULL,
          output = ${JSON.stringify({ status: JobStatus.Failed, message })}::jsonb
      WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
    `.execute(this.db);
  }

  async markDead(jobId: string, queue: QueueName): Promise<{ payload: { data?: object } }[]> {
    const result = await sql<{ payload: { data?: object } }>`
      UPDATE background_job
      SET state = 'dead', completed_on = COALESCE(completed_on, now()),
          delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
          lease_id = NULL, lease_expires_at = NULL, dispatch_token = NULL,
          output = COALESCE(output, ${JSON.stringify({ message: 'Queue delivery exhausted' })}::jsonb)
      WHERE id = ${jobId}::uuid AND queue = ${queue} AND consumer = 'worker'
        AND state IN ('created', 'active', 'retry')
      RETURNING payload
    `.execute(this.db);
    return result.rows;
  }

  async renewLease(job: ClaimedJob): Promise<void> {
    await sql`
      UPDATE background_job SET lease_expires_at = now() + (${JOB_EXPIRE_SECONDS} * interval '1 second')
      WHERE id = ${job.id}::uuid AND state = 'active' AND lease_id = ${job.lease_id}::uuid
    `.execute(this.db);
  }

  async reclaimStaleJobs(): Promise<ReclaimedJob[]> {
    const result = await sql<ReclaimedJob>`
      UPDATE background_job
      SET state = CASE WHEN retry_count + 1 > retry_limit THEN 'failed' ELSE 'retry' END,
          retry_count = retry_count + 1,
          start_after = now() + (${JOB_RETRY_DELAY_SECONDS} * power(2, retry_count) * interval '1 second'),
          completed_on = CASE WHEN retry_count + 1 > retry_limit THEN now() ELSE NULL END,
          published_on = NULL, dispatch_token = NULL,
          delete_after = CASE WHEN retry_count + 1 > retry_limit
            THEN now() + (${JOB_RETENTION_SECONDS} * interval '1 second') ELSE NULL END,
          lease_id = NULL, lease_expires_at = NULL,
          output = jsonb_build_object('status', 'failed', 'message', CASE
            WHEN retry_count + 1 > retry_limit THEN 'Job lease expired; retry limit exhausted'
            ELSE 'Recovered after an expired job lease' END)
      WHERE state = 'active' AND lease_expires_at <= now()
      RETURNING id::text, payload, (retry_count > retry_limit) AS exhausted
    `.execute(this.db);
    return result.rows;
  }

  async recoverOrphanedPublishedJobs(timeoutSeconds: number): Promise<number> {
    const result = await sql<{ id: string }>`
      UPDATE background_job SET published_on = NULL, dispatch_token = NULL
      WHERE consumer = 'worker' AND state IN ('created', 'retry')
        AND published_on <= now() - (${timeoutSeconds} * interval '1 second')
      RETURNING id::text
    `.execute(this.db);
    return result.rows.length;
  }

  async purgeExpiredJobs(): Promise<number> {
    const result = await sql<{ id: string }>`
      DELETE FROM background_job WHERE delete_after <= now() AND state IN ('completed', 'failed', 'dead')
      RETURNING id::text
    `.execute(this.db);
    return result.rows.length;
  }

  async getJobCounts(queue: QueueName): Promise<JobCounts> {
    const result = await sql<CloudJobCountsRow>`
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE state = 'active')::int AS active,
        count(*) FILTER (WHERE state IN ('created', 'retry'))::int AS queued,
        count(*) FILTER (WHERE state IN ('created', 'retry') AND start_after > now())::int AS deferred,
        count(*) FILTER (WHERE state IN ('failed', 'dead'))::int AS failed
      FROM background_job
      WHERE queue = ${queue}
    `.execute(this.db);
    return this.withReadyCount(result.rows[0] ?? this.emptyCounts());
  }

  getProcessingResults() {
    return this.db.selectFrom('background_job').select(['name', 'state', 'output']).orderBy('created_on').execute();
  }

  async getAllJobCounts(): Promise<Record<QueueName, JobCounts>> {
    const result = await sql<CloudJobCountsRow>`
      SELECT
        queue,
        count(*)::int AS total,
        count(*) FILTER (WHERE state = 'active')::int AS active,
        count(*) FILTER (WHERE state IN ('created', 'retry'))::int AS queued,
        count(*) FILTER (WHERE state IN ('created', 'retry') AND start_after > now())::int AS deferred,
        count(*) FILTER (WHERE state IN ('failed', 'dead'))::int AS failed
      FROM background_job
      WHERE queue = ANY(${sql.val(Object.values(QueueName))}::text[])
      GROUP BY queue
    `.execute(this.db);
    const byQueue = new Map(result.rows.map((row) => [row.queue, this.withReadyCount(row)]));
    return Object.fromEntries(
      Object.values(QueueName).map((queue) => [queue, byQueue.get(queue) ?? this.emptyCounts()]),
    ) as Record<QueueName, JobCounts>;
  }

  async getJobHistory(limit: number, offset = 0): Promise<{ jobs: JobHistoryEntry[]; total: number }> {
    const [count, history] = await Promise.all([
      sql<{ total: number }>`
        SELECT count(*)::int AS total
        FROM background_job
        WHERE name = ANY(${sql.val(Object.values(JobName))}::text[])
      `.execute(this.db),
      sql<CloudJobRow>`
        SELECT id::text, queue, name, payload, state, retry_count, created_on, started_on, completed_on, output
        FROM background_job
        WHERE name = ANY(${sql.val(Object.values(JobName))}::text[])
        ORDER BY COALESCE(started_on, created_on) DESC, created_on DESC
        LIMIT ${limit} OFFSET ${offset}
      `.execute(this.db),
    ]);

    return {
      jobs: history.rows.map((row) => this.toHistory(row)),
      total: Number(count.rows[0]?.total ?? 0),
    };
  }

  async getReferencedTemporaryPaths(): Promise<Set<string>> {
    const result = await sql<{ storage_path: string | null }>`
      SELECT jsonb_path_query(payload, '$.**.storagePath') #>> '{}' AS storage_path
      FROM background_job
      WHERE state IN ('created', 'retry', 'active')
        AND jsonb_path_exists(payload, '$.**.storagePath')
    `.execute(this.db);
    return new Set(
      result.rows.flatMap(({ storage_path }) => (storage_path?.startsWith('temporary/') ? [storage_path] : [])),
    );
  }

  async discardQueuedDuplicates(itemName: JobName): Promise<void> {
    await sql`
      DELETE FROM background_job
      WHERE name = ${itemName}
        AND state IN ('created', 'retry')
        AND payload ->> 'name' = ${itemName}
    `.execute(this.db);
  }

  isPaused(_queue: QueueName): boolean {
    return false;
  }

  pause(_queue: QueueName): Promise<void> {
    return Promise.reject(new UnsupportedOperationError('Pausing cloud queues is not supported yet'));
  }

  resume(_queue: QueueName): Promise<void> {
    return Promise.reject(new UnsupportedOperationError('Resuming cloud queues is not supported yet'));
  }

  empty(_queue: QueueName): Promise<void> {
    return Promise.reject(new UnsupportedOperationError('Emptying cloud queues is not supported yet'));
  }

  clearFailed(_queue: QueueName): Promise<void> {
    return Promise.reject(new UnsupportedOperationError('Clearing cloud queue failures is not supported yet'));
  }

  private emptyCounts(): JobCounts {
    return { active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 };
  }

  private withReadyCount(counts: Omit<JobCounts, 'ready'>): JobCounts {
    return { ...counts, ready: Math.max(counts.queued - counts.deferred, 0) };
  }

  private toHistory(row: CloudJobRow): JobHistoryEntry {
    const output = row.output && typeof row.output === 'object' ? (row.output as Record<string, unknown>) : {};
    const logicalStatus = output.status ?? output.value;
    let status: JobHistoryStatus;
    switch (row.state) {
      case 'failed': {
        status = 'failed';
        break;
      }
      case 'dead': {
        status = 'failed';
        break;
      }
      case 'active': {
        status = 'running';
        break;
      }
      case 'created': {
        status = 'queued';
        break;
      }
      case 'retry': {
        status = 'queued';
        break;
      }
      default: {
        switch (logicalStatus) {
          case JobStatus.Skipped: {
            status = 'skipped';
            break;
          }
          case JobStatus.Failed: {
            status = 'failed';
            break;
          }
          default: {
            status = 'succeeded';
          }
        }
      }
    }

    const nestedValue = output.value && typeof output.value === 'object' ? output.value : undefined;
    const error =
      typeof output.message === 'string'
        ? output.message
        : nestedValue && 'message' in nestedValue && typeof nestedValue.message === 'string'
          ? nestedValue.message
          : null;

    return {
      id: row.id,
      name: row.payload.name,
      activityId: this.activityId(row.payload),
      queue: row.queue as QueueName,
      status,
      createdAt: row.created_on.toISOString(),
      startedAt: row.started_on?.toISOString() ?? null,
      finishedAt: row.completed_on?.toISOString() ?? null,
      durationMs:
        row.started_on && row.completed_on ? Math.max(0, row.completed_on.getTime() - row.started_on.getTime()) : null,
      attempt: row.retry_count + 1,
      error,
    };
  }

  private activityId(payload: CloudJobRow['payload']): string | null {
    const data = payload.data;
    if (!payload.name.startsWith('Activity') || !data || typeof data !== 'object' || !('id' in data)) {
      return null;
    }
    return typeof data.id === 'string' ? data.id : null;
  }
}
