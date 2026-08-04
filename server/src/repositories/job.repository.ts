import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
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
  // File deletion is idempotent and keyless, so duplicate suppression would buy nothing.
  [QueueName.Storage]: 'standard',
};

const CRON_JOBS: { item: JobItem; cron: string }[] = [
  {
    item: { name: JobName.ActivityParseQueueAll, data: { force: false } },
    cron: '30 3 * * *',
  },
];

const COMPLETION_POLL_MS = 100;

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
      // Graceful: stop fetching, let in-flight handlers finish, then close the pool. A job that
      // outlives the timeout is not lost, it is simply left active until `expireInSeconds`
      // elapses and the supervisor hands it to another worker.
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
      case JobName.ActivityParse: {
        return {
          singletonKey: `${item.name}:${item.data.id}`,
        };
      }

      case JobName.ActivityDelete: {
        return { singletonKey: `${item.name}:${item.data.id}` };
      }

      case JobName.ActivityParseQueueAll: {
        // A constant key: one full scan at a time, however many times it is requested.
        return { singletonKey: item.name };
      }

      case JobName.FileDelete: {
        return {};
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
      // pg-boss keeps its own pool: a fetch loop that competes with request handlers for the
      // application's connections turns a queue backlog into an API outage.
      // Consumers need a connection per concurrent job plus headroom for maintenance.
      max: consuming ? totalConcurrency + 4 : 2,
      schema: jobs.schema,
      // pg-boss owns its schema and its own migration history. Tying it to kondis's Kysely
      // migrations would mean hand-porting upstream DDL on every upgrade.
      createSchema: true,
      migrate: true,
      // Maintenance, expiry and cron only run where jobs are consumed. An api-only process
      // should not be quietly responsible for reaping another machine's expired jobs.
      supervise: consuming,
      schedule: consuming && jobs.cron,
      // Wake workers the instant a job is inserted instead of waiting out the poll interval.
      // Holds one dedicated connection; polling continues underneath as the correctness floor.
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
        // Exponential rather than fixed: the usual cause of a burst of failures is a dependency
        // that is down, and hammering it at a fixed interval is how a blip becomes an outage.
        retryBackoff: true,
        expireInSeconds,
        deleteAfterSeconds,
        notify: true,
      };

      await boss.createQueue(queue, { ...options, policy: QUEUE_POLICY[queue] });
      // createQueue is a no-op on an existing queue, so configuration changes would otherwise
      // never reach a queue created by a previous release. Policy is immutable and excluded.
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
        // One job per fetch, `localConcurrency` fetch loops. Batching would hand several jobs
        // to one handler invocation and make a single failure fail all of them.
        batchSize: 1,
        localConcurrency: this.config.jobs.concurrency[queue],
        // NOTIFY does the waking; this is only the backstop for a dropped listener.
        pollingIntervalSeconds: 2,
        notifyPollingIntervalSeconds: 30,
      },
      async (jobs) => {
        for (const job of jobs) {
          await this.dispatch(job);
        }
      },
    );
  }

  private dispatch(job: Job<StoredJob>): Promise<void> {
    if (!this.onJobRun) {
      throw new Error('Received a job before workers were started');
    }

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
