import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Job, JobInsert, JobResult, SendOptions } from 'pg-boss';
import { PgBoss, fromKysely } from 'pg-boss';

import { JOB_SCHEMA } from 'src/constants';
import { JobName, JobStatus, QueueName } from 'src/enum';
import {
  CRON_JOBS,
  JOB_CONCURRENCY,
  JOB_CRON,
  JOB_EXPIRE_SECONDS,
  JOB_RETENTION_SECONDS,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  QUEUE_POLICY,
} from 'src/jobs/job-semantics';
import { Logger } from 'src/logger';
import { ConfigRepository } from 'src/repositories/config.repository';
import type { KondisTransaction } from 'src/types';
import { JobCounts, JobHistoryEntry, JobHistoryStatus, JobItem, JobOf } from 'src/types/jobs';
import { KondisStartupError, asErrorMessage } from 'src/utils/misc';

type StoredJob = { name: JobName; data?: object };

export type JobHandlerDescriptor<T extends JobName = JobName> = {
  jobName: T;
  queueName: QueueName;
  handler: (data: JobOf<T>) => Promise<JobStatus>;
  label: string;
};

export type AnyJobHandlerDescriptor = {
  [T in JobName]: JobHandlerDescriptor<T>;
}[JobName];

type RegisteredJobHandler = Omit<JobHandlerDescriptor, 'handler'> & {
  handler: (data: never) => Promise<JobStatus>;
};

type QueueJobOptions = {
  transaction?: KondisTransaction;
};

type StoredJobRow = {
  id: string;
  queue_name: string;
  source_name: string | null;
  job_name: string;
  activity_id: string | null;
  state: string;
  retry_count: number;
  created_on: Date;
  started_on: Date | null;
  completed_on: Date | null;
  output: unknown;
};

type RawJobCounts = Omit<JobCounts, 'ready'>;
type StoredJobCounts = RawJobCounts & { name: string };

const COMPLETION_POLL_MS = 100;
const WORKER_BATCH_SIZE = 25;

const deadLetterName = (queue: QueueName): string => `${queue}.deadLetter`;

export class JobRepository {
  private readonly handlers = new Map<JobName, RegisteredJobHandler>();
  private readonly pausedQueues = new Set<QueueName>();

  private bossPromise: Promise<PgBoss> | null = null;
  private onJobRun: ((item: JobItem) => Promise<JobStatus>) | null = null;
  private stopped = false;

  constructor(
    private readonly config: ConfigRepository,
    private readonly consumeJobs: boolean,
    private readonly logger: Pick<Logger, 'error' | 'log' | 'verbose' | 'warn'> = new Logger(JobRepository.name),
  ) {}

  setup(descriptors: readonly AnyJobHandlerDescriptor[]): void {
    for (const descriptor of descriptors) {
      const { jobName, label } = descriptor;
      const existing = this.handlers.get(jobName);

      if (existing) {
        throw new KondisStartupError(
          `Failed to add job handler for ${label}. JobName.${jobName} is already handled by ${existing.label}.`,
        );
      }

      this.handlers.set(jobName, descriptor as RegisteredJobHandler);
      this.logger.verbose(`Added job handler: ${jobName} => ${label}`);
    }

    for (const [jobKey, jobName] of Object.entries(JobName)) {
      if (!this.handlers.has(jobName)) {
        throw new KondisStartupError(
          `Failed to find a job handler for JobName.${jobKey} ("${jobName}"). ` +
            `Register an explicit JobName.${jobKey} handler descriptor before calling JobRepository.setup.`,
        );
      }
    }
  }

  async startWorkers(onJobRun: (item: JobItem) => Promise<JobStatus>): Promise<void> {
    if (!this.consumeJobs) {
      throw new Error('Job consumption is disabled for this application role');
    }
    this.onJobRun = onJobRun;

    const boss = await this.getBoss();
    for (const queue of Object.values(QueueName)) {
      await this.startWorker(boss, queue);
    }

    await this.applySchedules(boss);
  }

  run<T extends JobName>({ name, data }: JobItem): Promise<JobStatus> {
    const item = this.handlers.get(name);
    if (!item) {
      this.logger.warn(`Skipping unknown job: "${name}"`);
      return Promise.resolve(JobStatus.Skipped);
    }

    return item.handler(data as JobOf<T> as never);
  }

  queue(item: JobItem, options: QueueJobOptions = {}): Promise<void> {
    return this.queueAll([item], options);
  }

  async queueAll(items: JobItem[], options: QueueJobOptions = {}): Promise<void> {
    if (items.length === 0) {
      return;
    }

    const boss = await this.getBoss();
    const db = options.transaction ? fromKysely(options.transaction) : undefined;
    const byQueue = new Map<QueueName, JobInsert<StoredJob>[]>();

    for (const item of items) {
      const queueName = this.getQueueName(item.name);
      const entries = byQueue.get(queueName) ?? [];
      entries.push({
        data: { name: item.name, data: item.data },
        ...this.getJobOptions(item),
      });
      byQueue.set(queueName, entries);
    }

    for (const [queueName, jobs] of byQueue) {
      await boss.insert(queueName, jobs, { db, returnId: false });
    }
  }

  async getJobCounts(queue: QueueName): Promise<JobCounts> {
    const boss = await this.getBoss();
    const [counts, deadLetter] = await Promise.all([
      this.countJobs(boss, queue),
      this.countJobs(boss, deadLetterName(queue)),
    ]);

    return {
      ...counts,
      // Retained failures plus everything that exhausted its retries and was dead-lettered.
      failed: counts.failed + deadLetter.queued,
    };
  }

  async getAllJobCounts(): Promise<Record<QueueName, JobCounts>> {
    const boss = await this.getBoss();
    const queues = Object.values(QueueName);
    const names = [...queues, ...queues.map((queue) => deadLetterName(queue))];
    const definitions = await boss.getQueues(names);
    const namesByTable = new Map<string, string[]>();

    for (const { name, table } of definitions) {
      const tableNames = namesByTable.get(table) ?? [];
      tableNames.push(name);
      namesByTable.set(table, tableNames);
    }

    const rowGroups = await Promise.all(
      [...namesByTable].map(async ([table, tableNames]) => {
        const result = await boss.getDb().executeSql(
          `SELECT
               name,
               count(*)::int AS total,
               count(*) FILTER (WHERE state = 'active')::int AS active,
               count(*) FILTER (WHERE state IN ('created', 'retry'))::int AS queued,
               count(*) FILTER (WHERE state IN ('created', 'retry') AND start_after > now())::int AS deferred,
               count(*) FILTER (WHERE state = 'failed')::int AS failed
             FROM ${this.quoteIdentifier(JOB_SCHEMA)}.${this.quoteIdentifier(table)}
             WHERE name = ANY($1::text[])
             GROUP BY name`,
          [tableNames],
        );
        return result.rows as StoredJobCounts[];
      }),
    );
    const rows = rowGroups.flat();
    const countsByName = new Map(rows.map(({ name, ...counts }) => [name, this.withReadyCount(counts)]));
    const empty = (): JobCounts => ({ active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 });

    return Object.fromEntries(
      queues.map((queue) => {
        const counts = countsByName.get(queue) ?? empty();
        const deadLetter = countsByName.get(deadLetterName(queue)) ?? empty();
        return [queue, { ...counts, failed: counts.failed + deadLetter.queued }];
      }),
    ) as Record<QueueName, JobCounts>;
  }

  async getJobHistory(limit: number, offset = 0): Promise<{ jobs: JobHistoryEntry[]; total: number }> {
    const boss = await this.getBoss();
    const schema = this.quoteIdentifier(JOB_SCHEMA);
    const queueNames = Object.values(QueueName);
    const historyQueueNames = [...queueNames, ...queueNames.map((queue) => deadLetterName(queue))];
    const [countResult, historyResult] = await Promise.all([
      boss.getDb().executeSql(
        `SELECT COUNT(*)::int AS total
         FROM ${schema}.job
         WHERE name = ANY($1::text[])
           AND data ->> 'name' IS NOT NULL`,
        [historyQueueNames],
      ),
      boss.getDb().executeSql(
        `SELECT
         id::text,
         name AS queue_name,
         source_name,
         data ->> 'name' AS job_name,
         CASE WHEN data ->> 'name' LIKE 'Activity%' THEN data -> 'data' ->> 'id' END AS activity_id,
         state::text,
         retry_count,
         created_on,
         started_on,
         completed_on,
         output
       FROM ${schema}.job
       WHERE name = ANY($1::text[])
         AND data ->> 'name' IS NOT NULL
       ORDER BY COALESCE(started_on, created_on) DESC, created_on DESC
       LIMIT $2 OFFSET $3`,
        [historyQueueNames, limit, offset],
      ),
    ]);

    return {
      jobs: (historyResult.rows as StoredJobRow[]).map((row) => this.toJobHistoryEntry(row)),
      total: Number((countResult.rows[0] as { total: number }).total),
    };
  }

  async getReferencedTemporaryPaths(): Promise<Set<string>> {
    const boss = await this.getBoss();
    const paths = new Set<string>();

    for (const queueName of Object.values(QueueName)) {
      const queue = await boss.getQueue(queueName);
      if (!queue) {
        continue;
      }

      const table = `"${JOB_SCHEMA}"."${queue.table}"`;
      const { rows } = await boss.getDb().executeSql(
        `SELECT jsonb_path_query(data, '$.**.storagePath') #>> '{}' AS storage_path
         FROM ${table}
         WHERE state IN ('created', 'retry', 'active')
           AND jsonb_path_exists(data, '$.**.storagePath')`,
        [],
      );

      for (const row of rows as { storage_path: unknown }[]) {
        if (typeof row.storage_path === 'string' && row.storage_path.startsWith('temporary/')) {
          paths.add(row.storage_path);
        }
      }
    }

    return paths;
  }

  async pause(queue: QueueName): Promise<void> {
    this.pausedQueues.add(queue);

    const boss = await this.getBoss();
    await boss.offWork(queue);
    await this.waitForQueueIdle(queue);
    this.logger.log(`Paused queue: ${queue}`);
  }

  async resume(queue: QueueName): Promise<void> {
    if (!this.pausedQueues.delete(queue)) {
      return;
    }

    if (!this.onJobRun) {
      this.logger.warn(`Cannot resume ${queue}: this process is not a job worker`);
      return;
    }

    const boss = await this.getBoss();
    await this.startWorker(boss, queue);
    this.logger.log(`Resumed queue: ${queue}`);
  }

  isPaused(queue: QueueName): boolean {
    return this.pausedQueues.has(queue);
  }

  async empty(queue: QueueName): Promise<void> {
    const boss = await this.getBoss();
    await boss.deleteQueuedJobs(queue);
  }

  async clearFailed(queue: QueueName): Promise<void> {
    const boss = await this.getBoss();
    await boss.deleteStoredJobs(queue);
    await boss.deleteQueuedJobs(deadLetterName(queue));
    await boss.deleteStoredJobs(deadLetterName(queue));
  }

  async discardQueuedDuplicates(itemName: JobName): Promise<void> {
    const boss = await this.getBoss();
    const queueName = this.getQueueName(itemName);
    const queue = await boss.getQueue(queueName);
    if (!queue) {
      return;
    }

    const table = `"${JOB_SCHEMA}"."${queue.table}"`;
    await boss.getDb().executeSql(
      `DELETE FROM ${table}
       WHERE name = $1
         AND state IN ('created', 'retry')
         AND data ->> 'name' = $2`,
      [queueName, itemName],
    );
  }

  async waitForQueueCompletion(...queues: QueueName[]): Promise<void> {
    const names = queues.length > 0 ? queues : Object.values(QueueName);

    for (;;) {
      const counts = await Promise.all(names.map((queue) => this.getJobCounts(queue)));
      if (counts.every(({ active, ready }) => active === 0 && ready === 0)) {
        return;
      }

      await delay(COMPLETION_POLL_MS);
    }
  }

  async waitForQueueIdle(...queues: QueueName[]): Promise<void> {
    const names = queues.length > 0 ? queues : Object.values(QueueName);

    for (;;) {
      const counts = await Promise.all(names.map((queue) => this.getJobCounts(queue)));
      if (counts.every(({ active }) => active === 0)) {
        return;
      }

      await delay(COMPLETION_POLL_MS);
    }
  }

  async stop(): Promise<void> {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    if (!this.bossPromise) {
      return;
    }
    this.logger.log('Stopping job workers');

    try {
      const boss = await this.bossPromise;
      await boss.stop({ graceful: true, close: true, timeout: 30_000 });
    } catch (error) {
      this.logger.error(`Failed to stop job workers cleanly: ${asErrorMessage(error)}`);
    }
  }

  private async countJobs(boss: PgBoss, name: string): Promise<JobCounts> {
    const empty: JobCounts = { active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 };

    const queue = await boss.getQueue(name);
    if (!queue) {
      return empty;
    }

    const table = `"${JOB_SCHEMA}"."${queue.table}"`;
    const { rows } = await boss.getDb().executeSql(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE state = 'active')::int AS active,
         count(*) FILTER (WHERE state IN ('created', 'retry'))::int AS queued,
         count(*) FILTER (WHERE state IN ('created', 'retry') AND start_after > now())::int AS deferred,
         count(*) FILTER (WHERE state = 'failed')::int AS failed
       FROM ${table}
       WHERE name = $1`,
      [name],
    );

    const row = rows.at(0) as RawJobCounts | undefined;
    if (!row) {
      return empty;
    }

    return this.withReadyCount(row);
  }

  private withReadyCount(counts: RawJobCounts): JobCounts {
    return { ...counts, ready: Math.max(counts.queued - counts.deferred, 0) };
  }

  private getQueueName(name: JobName): QueueName {
    const item = this.handlers.get(name);
    if (!item) {
      throw new Error(`No handler registered for job "${name}"; was JobRepository.setup called?`);
    }

    return item.queueName;
  }

  private getJobOptions(item: JobItem): Pick<SendOptions, 'singletonKey' | 'priority'> {
    switch (item.name) {
      case JobName.AuthCredentialCleanup: {
        return { singletonKey: item.name };
      }

      case JobName.ActivityUpload: {
        // Disk-backed HTTP uploads do not have a checksum until the worker reads
        // the staged file. Use the unique temporary path in that case so a batch
        // of uploads is not collapsed into the singleton key "undefined".
        return {
          singletonKey: `${item.name}:${item.data.checksum ?? item.data.storagePath}`,
        };
      }

      case JobName.ActivityMetricCompute:
      case JobName.ActivityBestEffortCompute:
      case JobName.ActivityRouteMatchCompute:
      case JobName.ActivityParse: {
        return {
          singletonKey: `${item.name}:${item.data.id}`,
        };
      }

      case JobName.ActivityManualCreate: {
        return { singletonKey: `${item.name}:${item.data.id}` };
      }

      case JobName.ActivityBestEffortRank: {
        // The queue itself is exclusive, so an empty singleton key silently drops a later
        // refresh while another is queued or active. Give every request a key; the handler
        // removes redundant queued refreshes immediately before calculating the rankings.
        return { singletonKey: `${item.name}:${randomUUID()}`, priority: -1 };
      }

      case JobName.ActivityDelete: {
        return { singletonKey: `${item.name}:${item.data.id}` };
      }

      case JobName.ActivityImageIngest: {
        return { singletonKey: `${item.name}:${item.data.imageId}` };
      }

      case JobName.ActivityImageAttach: {
        return { singletonKey: `${item.name}:${item.data.uploadId}` };
      }

      case JobName.ActivityImageGenerateThumbnails: {
        return { singletonKey: `${item.name}:${item.data.id}` };
      }

      case JobName.ActivityImageGenerateQueueAll: {
        return { singletonKey: item.name };
      }

      case JobName.LagomTakeoutImport: {
        return {};
      }

      case JobName.UserAvatarUpload: {
        return {};
      }

      case JobName.ActivityParseQueueAll: {
        // A constant key: one full scan at a time, however many times it is requested.
        return { singletonKey: item.name };
      }

      case JobName.FileDelete: {
        return {};
      }

      case JobName.TemporaryFileCleanup: {
        return { singletonKey: item.name };
      }
    }
  }

  private getBoss(): Promise<PgBoss> {
    if (this.stopped) {
      return Promise.reject(new Error('Job repository is stopped'));
    }
    this.bossPromise ??= this.createBoss().catch((error: unknown) => {
      this.bossPromise = null;
      throw error;
    });

    return this.bossPromise;
  }

  private async createBoss(): Promise<PgBoss> {
    const { database } = this.config;
    const totalConcurrency = Object.values(JOB_CONCURRENCY).reduce((sum, value) => sum + value, 0);

    const boss = new PgBoss({
      host: database.host,
      port: database.port,
      user: database.user,
      password: database.password,
      database: database.database,
      application_name: 'kondis-jobs',
      max: this.consumeJobs ? totalConcurrency + 4 : 2,
      schema: JOB_SCHEMA,
      createSchema: true,
      migrate: true,
      supervise: this.consumeJobs,
      schedule: this.consumeJobs && JOB_CRON,
      useListenNotify: this.consumeJobs,
    });

    boss.on('error', (error) => this.logger.error(`Queue error: ${asErrorMessage(error)}`));
    boss.on('warning', ({ message, data }) => this.logger.warn(`Queue warning: ${message} ${JSON.stringify(data)}`));

    await boss.start();
    await this.createQueues(boss);

    this.logger.log(`Connected to job schema "${JOB_SCHEMA}" (consuming=${this.consumeJobs})`);

    return boss;
  }

  private async createQueues(boss: PgBoss): Promise<void> {
    for (const queue of Object.values(QueueName)) {
      const deadLetter = deadLetterName(queue);

      await boss.createQueue(deadLetter, { policy: 'standard', retryLimit: 0 });

      const options = {
        deadLetter,
        retryLimit: JOB_RETRY_LIMIT,
        retryDelay: JOB_RETRY_DELAY_SECONDS,
        retryBackoff: true,
        expireInSeconds: JOB_EXPIRE_SECONDS,
        deleteAfterSeconds: JOB_RETENTION_SECONDS,
        notify: true,
      };

      await boss.createQueue(queue, { ...options, policy: QUEUE_POLICY[queue] });
      await boss.updateQueue(queue, options);
    }
  }

  private async startWorker(boss: PgBoss, queue: QueueName): Promise<void> {
    if (this.pausedQueues.has(queue)) {
      return;
    }

    await boss.work<StoredJob>(
      queue,
      {
        batchSize: WORKER_BATCH_SIZE,
        burstWhenBatchFull: true,
        localConcurrency: JOB_CONCURRENCY[queue],
        perJobResults: true,
        pollingIntervalSeconds: 2,
        notifyPollingIntervalSeconds: 30,
      },
      (jobs) => this.dispatchBatch(jobs),
    );
  }

  private async dispatchBatch(jobs: Job<StoredJob>[]): Promise<JobResult[]> {
    const rankingRefreshes: Job<StoredJob>[] = [];
    const results: JobResult[] = [];

    for (const job of jobs) {
      if (job.data.name === JobName.ActivityBestEffortRank) {
        // TODO: remove this workaround
        rankingRefreshes.push(job);
        continue;
      }

      results.push(await this.dispatchResult(job));
    }

    const rankingRefresh = rankingRefreshes.pop();
    for (const duplicate of rankingRefreshes) {
      results.push({ id: duplicate.id, status: 'completed', output: { status: JobStatus.Skipped } });
    }
    if (rankingRefresh) {
      results.push(await this.dispatchResult(rankingRefresh));
    }

    return results;
  }

  private dispatch(job: Job<StoredJob>): Promise<JobStatus> {
    if (!this.onJobRun) {
      throw new Error('Received a job before workers were started');
    }

    return this.onJobRun({ name: job.data.name, data: job.data.data } as JobItem);
  }

  private async dispatchResult(job: Job<StoredJob>): Promise<JobResult> {
    try {
      const status = await this.dispatch(job);
      return { id: job.id, status: 'completed', output: { status } };
    } catch (error) {
      return { id: job.id, status: 'failed', output: { message: asErrorMessage(error) } };
    }
  }

  private quoteIdentifier(value: string): string {
    if (value.startsWith('"') && value.endsWith('"')) {
      return value;
    }
    return `"${value.replaceAll('"', '""')}"`;
  }

  private toJobHistoryEntry(row: StoredJobRow): JobHistoryEntry {
    const queueValue = row.source_name ?? row.queue_name.replace(/\.deadLetter$/, '');
    const queue = Object.values(QueueName).find((value) => value === queueValue);
    if (!queue) {
      throw new Error(`Unexpected queue in job history: ${queueValue}`);
    }

    const output = row.output && typeof row.output === 'object' ? (row.output as Record<string, unknown>) : {};
    const logicalStatus = output.status ?? output.value;
    let status: JobHistoryStatus;
    if (row.queue_name.endsWith('.deadLetter') || row.state === 'failed') {
      status = 'failed';
    } else if (row.state === 'active') {
      status = 'running';
    } else if (row.state === 'created' || row.state === 'retry') {
      status = 'queued';
    } else if (logicalStatus === JobStatus.Skipped) {
      status = 'skipped';
    } else if (logicalStatus === JobStatus.Failed) {
      status = 'failed';
    } else {
      status = 'succeeded';
    }

    const startedAt = row.started_on?.toISOString() ?? null;
    const finishedAt = row.completed_on?.toISOString() ?? null;
    const nestedValue = output.value && typeof output.value === 'object' ? output.value : undefined;
    const nestedMessage =
      nestedValue && 'message' in nestedValue && typeof nestedValue.message === 'string' ? nestedValue.message : null;
    const error = typeof output.message === 'string' ? output.message : nestedMessage;
    const durationMs =
      row.started_on && row.completed_on ? Math.max(0, row.completed_on.getTime() - row.started_on.getTime()) : null;

    return {
      id: row.id,
      name: row.job_name,
      activityId: row.activity_id,
      queue,
      status,
      createdAt: row.created_on.toISOString(),
      startedAt,
      finishedAt,
      durationMs,
      attempt: row.retry_count + 1,
      error,
    };
  }

  private async applySchedules(boss: PgBoss): Promise<void> {
    if (!JOB_CRON) {
      return;
    }

    const expected = new Set<string>();

    for (const { item, cron } of CRON_JOBS) {
      const queueName = this.getQueueName(item.name);
      expected.add(`${queueName}:${item.name}`);

      await boss.schedule(queueName, cron, { name: item.name, data: item.data } satisfies StoredJob, {
        key: item.name,
        tz: 'UTC',
        ...this.getJobOptions(item),
      });
    }

    for (const schedule of await boss.getSchedules()) {
      if (expected.has(`${schedule.name}:${schedule.key}`)) {
        continue;
      }

      this.logger.log(`Removing stale schedule: ${schedule.name}/${schedule.key}`);
      await boss.unschedule(schedule.name, schedule.key);
    }
  }
}
