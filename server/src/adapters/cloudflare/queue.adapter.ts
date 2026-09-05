import { sql } from 'kysely';

import { insertBackgroundJobs } from 'src/cloudflare/background-job';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { UnsupportedOperationError } from 'src/errors';
import type { JobAdminPort, JobProducerPort } from 'src/ports/queue.port';
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

export class CloudflareQueueAdapter implements JobProducerPort, JobAdminPort {
  constructor(private readonly db: KondisDatabase) {}

  async queue(item: JobItem, options: { transaction?: KondisTransaction } = {}): Promise<void> {
    await this.queueAll([item], options);
  }

  async queueAll(items: JobItem[], options: { transaction?: KondisTransaction } = {}): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const executor: KondisExecutor = options.transaction ?? this.db;
    await insertBackgroundJobs(executor, items);
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
