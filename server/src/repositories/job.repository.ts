import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Job, JobInsert, QueuePolicy, SendOptions } from 'pg-boss';
import { PgBoss, fromKysely } from 'pg-boss';

import { ConfigService } from 'src/config/config.service';
import { KondisTransaction } from 'src/db/database';
import type { JobConfig } from 'src/decorators';
import { JobName, JobStatus, MetadataKey, QueueName, WorkerType } from 'src/enum';
import { JobCounts, JobItem, JobOf } from 'src/types';
import { KondisStartupError, asErrorMessage, getKeyByValue, getMethodNames } from 'src/utils/misc';

type StoredJob = { name: JobName; data?: object };

type JobMapItem = {
  jobName: JobName;
  queueName: QueueName;
  handler: (data: never) => Promise<JobStatus>;
  label: string;
};

export type QueueJobOptions = {
  transaction?: KondisTransaction;
};

const QUEUE_POLICY: Record<QueueName, QueuePolicy> = {
  [QueueName.ActivityParsing]: 'exclusive',
  [QueueName.BackgroundTask]: 'exclusive',
  [QueueName.Storage]: 'standard',
};

const CRON_JOBS: { item: JobItem; cron: string }[] = [
  {
    item: { name: JobName.ActivityParseQueueAll, data: { force: false } },
    cron: '30 3 * * *',
  },
  {
    item: { name: JobName.TemporaryFileCleanup, data: {} },
    cron: '0 4 * * *',
  },
];

const COMPLETION_POLL_MS = 100;
const WORKER_BATCH_SIZE = 25;

const deadLetterName = (queue: QueueName): string => `${queue}.deadLetter`;

@Injectable()
export class JobRepository implements OnApplicationShutdown {
  private readonly logger = new Logger(JobRepository.name);
  private readonly handlers: Partial<Record<JobName, JobMapItem>> = {};
  private readonly pausedQueues = new Set<QueueName>();

  private bossPromise: Promise<PgBoss> | null = null;
  private onJobRun: ((item: JobItem) => Promise<void>) | null = null;
  private stopped = false;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  setup(services: (new (...args: never[]) => unknown)[]): void {
    for (const Service of services) {
      const instance = this.moduleRef.get<Record<string, unknown>>(Service, { strict: false });

      for (const methodName of getMethodNames(instance)) {
        // SAFETY: @OnJob metadata is considered only for service methods with the JobStatus handler contract.
        const handler = instance[methodName] as ((data: never) => Promise<JobStatus>) | undefined;
        if (typeof handler !== 'function') {
          continue;
        }

        const config = this.reflector.get<JobConfig | undefined>(MetadataKey.JobConfig, handler);
        if (!config) {
          continue;
        }

        const { name: jobName, queue: queueName } = config;
        const label = `${Service.name}.${methodName}`;
        const existing = this.handlers[jobName];

        if (existing) {
          const jobKey = getKeyByValue(JobName, jobName);
          throw new KondisStartupError(
            `Failed to add job handler for ${label}. JobName.${jobKey} is already handled by ${existing.label}.`,
          );
        }

        this.handlers[jobName] = { jobName, queueName, label, handler: handler.bind(instance) };
        this.logger.verbose(`Added job handler: ${jobName} => ${label}`);
      }
    }

    for (const [jobKey, jobName] of Object.entries(JobName)) {
      if (!this.handlers[jobName]) {
        throw new KondisStartupError(
          `Failed to find a job handler for JobName.${jobKey} ("${jobName}"). ` +
            `Add @OnJob({ name: JobName.${jobKey}, queue: QueueName.XYZ }) to a method on a class listed in src/services/index.ts.`,
        );
      }
    }
  }

  async startWorkers(onJobRun: (item: JobItem) => Promise<void>): Promise<void> {
    this.onJobRun = onJobRun;

    const boss = await this.getBoss();
    for (const queue of Object.values(QueueName)) {
      await this.startWorker(boss, queue);
    }

    await this.applySchedules(boss);
  }

  run<T extends JobName>({ name, data }: JobItem): Promise<JobStatus> {
    const item = this.handlers[name];
    if (!item) {
      this.logger.warn(`Skipping unknown job: "${name}"`);
      return Promise.resolve(JobStatus.Skipped);
    }

    // SAFETY: handlers are registered against the same JobName key that determines the JobOf payload.
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

  async getReferencedTemporaryPaths(): Promise<Set<string>> {
    const boss = await this.getBoss();
    const paths = new Set<string>();

    for (const queueName of Object.values(QueueName)) {
      const queue = await boss.getQueue(queueName);
      if (!queue) {
        continue;
      }

      const table = `"${this.config.jobs.schema}"."${queue.table}"`;
      const { rows } = await boss.getDb().executeSql(
        `SELECT data #>> '{data,storagePath}' AS storage_path
         FROM ${table}
         WHERE state IN ('created', 'retry', 'active')
           AND data #>> '{data,storagePath}' IS NOT NULL`,
        [],
      );

      // SAFETY: The SQL query aliases its sole selected field as storage_path.
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

    const table = `"${this.config.jobs.schema}"."${queue.table}"`;
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

  async onApplicationShutdown(): Promise<void> {
    if (!this.bossPromise || this.stopped) {
      return;
    }

    this.stopped = true;
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

    const table = `"${this.config.jobs.schema}"."${queue.table}"`;
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

    // SAFETY: The count query selects every JobCounts field with integer values.
    const row = rows.at(0) as JobCounts | undefined;
    if (!row) {
      return empty;
    }

    return { ...row, ready: Math.max(row.queued - row.deferred, 0) };
  }

  private getQueueName(name: JobName): QueueName {
    const item = this.handlers[name];
    if (!item) {
      throw new Error(`No handler registered for job "${name}"; was JobRepository.setup called?`);
    }

    return item.queueName;
  }

  private getJobOptions(item: JobItem): Pick<SendOptions, 'singletonKey' | 'priority'> {
    switch (item.name) {
      case JobName.ActivityUpload: {
        return { singletonKey: `${item.name}:${item.data.checksum}` };
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

      case JobName.LagomTakeoutImport: {
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
    this.bossPromise ??= this.createBoss().catch((error: unknown) => {
      this.bossPromise = null;
      throw error;
    });

    return this.bossPromise;
  }

  private async createBoss(): Promise<PgBoss> {
    const { database, jobs } = this.config;
    const consuming = this.config.hasWorker(WorkerType.JOBS);
    const totalConcurrency = Object.values(jobs.concurrency).reduce((sum, value) => sum + value, 0);

    const boss = new PgBoss({
      host: database.host,
      port: database.port,
      user: database.user,
      password: database.password,
      database: database.database,
      application_name: 'kondis-jobs',
      max: consuming ? totalConcurrency + 4 : 2,
      schema: jobs.schema,
      createSchema: true,
      migrate: true,
      supervise: consuming,
      schedule: consuming && jobs.cron,
      useListenNotify: consuming,
    });

    boss.on('error', (error) => this.logger.error(`Queue error: ${asErrorMessage(error)}`));
    boss.on('warning', ({ message, data }) => this.logger.warn(`Queue warning: ${message} ${JSON.stringify(data)}`));

    await boss.start();
    await this.createQueues(boss);

    this.logger.log(`Connected to job schema "${jobs.schema}" (consuming=${consuming})`);

    return boss;
  }

  private async createQueues(boss: PgBoss): Promise<void> {
    const { retryLimit, retryDelaySeconds, expireInSeconds, deleteAfterSeconds } = this.config.jobs;

    for (const queue of Object.values(QueueName)) {
      const deadLetter = deadLetterName(queue);

      await boss.createQueue(deadLetter, { policy: 'standard', retryLimit: 0 });

      const options = {
        deadLetter,
        retryLimit,
        retryDelay: retryDelaySeconds,
        retryBackoff: true,
        expireInSeconds,
        deleteAfterSeconds,
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
        localConcurrency: this.config.jobs.concurrency[queue],
        pollingIntervalSeconds: 2,
        notifyPollingIntervalSeconds: 30,
      },
      async (jobs) => {
        await this.dispatchBatch(jobs);
      },
    );
  }

  private async dispatchBatch(jobs: Job<StoredJob>[]): Promise<void> {
    let rankingRefresh: Job<StoredJob> | undefined;

    for (const job of jobs) {
      if (job.data.name === JobName.ActivityBestEffortRank) {
        // pg-boss marks the whole prefetched batch active before invoking us, so the ranking
        // handler cannot delete these duplicates from the queue. Keep one refresh and run it
        // after every computation in this batch; queued duplicates are discarded by the handler.
        rankingRefresh = job;
        continue;
      }

      await this.dispatch(job);
    }

    if (rankingRefresh) {
      await this.dispatch(rankingRefresh);
    }
  }

  private dispatch(job: Job<StoredJob>): Promise<void> {
    if (!this.onJobRun) {
      throw new Error('Received a job before workers were started');
    }

    // SAFETY: StoredJob values are created from JobItem instances before being handed to pg-boss.
    return this.onJobRun({ name: job.data.name, data: job.data.data } as JobItem);
  }

  private async applySchedules(boss: PgBoss): Promise<void> {
    if (!this.config.jobs.cron) {
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
