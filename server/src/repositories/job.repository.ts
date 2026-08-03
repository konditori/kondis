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

/**
 * pg-boss models a queue and a job name as the same string, so a job's own name travels inside
 * the payload. That preserves the many-jobs-per-queue grouping that makes a single concurrency
 * limit and a single pause switch meaningful for a set of related work.
 */
type StoredJob = { name: JobName; data?: object };

type JobMapItem = {
  jobName: JobName;
  queueName: QueueName;
  handler: (data: never) => Promise<JobStatus>;
  /** `ClassName.methodName`, for error messages that point at the offending code. */
  label: string;
};

export type QueueJobOptions = {
  /**
   * Enqueue on an open Kysely transaction instead of the pool.
   *
   * The job row is then written in the same transaction as the data it is about, so the two
   * commit or roll back together. This is the property a Redis-backed queue structurally
   * cannot offer: there, the window between "row committed" and "job enqueued" is a real gap
   * where a crash strands the row.
   */
  transaction?: KondisTransaction;
};

/**
 * A queue's policy decides what "already queued" means, and it cannot be changed after the
 * queue row exists — changing one requires deleting and recreating the queue.
 *
 * `exclusive` allows at most one job per `singletonKey` in the created, retry, or active
 * states, so re-requesting work that is already pending or running is a no-op rather than a
 * duplicate. Failed and completed jobs do not block, so a retry after exhaustion still works.
 * Every job on an exclusive queue must therefore carry a key; without one they would all
 * collide on the empty string and the queue would run strictly one job at a time.
 */
const QUEUE_POLICY: Record<QueueName, QueuePolicy> = {
  [QueueName.ActivityParsing]: 'exclusive',
  [QueueName.BackgroundTask]: 'exclusive',
  // File deletion is idempotent and keyless, so duplicate suppression would buy nothing.
  [QueueName.Storage]: 'standard',
};

/**
 * Recurring work, registered with pg-boss's scheduler.
 *
 * The schedule lives in the database, not in a process timer, so exactly one tick happens per
 * cron expression no matter how many workers are running.
 */
const CRON_JOBS: { item: JobItem; cron: string }[] = [
  {
    // Nightly sweep for uploads that never became activities: a parse that failed against a
    // now-fixed parser bug, or a row whose enqueue was lost. Non-forcing, so it is a no-op on
    // a healthy install.
    item: { name: JobName.ActivityParseQueueAll, data: { force: false } },
    cron: '30 3 * * *',
  },
];

/** Poll interval for `waitForQueueCompletion`. */
const COMPLETION_POLL_MS = 100;

/** Dead letter queues are real pg-boss queues, so they need names that cannot collide with ours. */
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

  /**
   * Bind every `@OnJob` method to the job it handles.
   *
   * Called once at startup with the list of service classes. Reflecting over instances rather
   * than importing them is what keeps the graph acyclic: this file is below `services/` and
   * must never import anything from it.
   *
   * Both failure modes are fatal. A duplicate handler means two pieces of code believe they
   * own a job and only one would ever run; a missing handler means a producer can enqueue work
   * that nothing will ever consume. Neither is something to discover in production.
   */
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

  /**
   * Begin consuming every queue in this process.
   *
   * Handlers are already bound by `setup`; `onJobRun` is the hook that lets `JobService` wrap
   * each execution with logging and status handling without this file importing it.
   */
  async startWorkers(onJobRun: (item: JobItem) => Promise<void>): Promise<void> {
    this.onJobRun = onJobRun;

    const boss = await this.getBoss();
    for (const queue of Object.values(QueueName)) {
      await this.startWorker(boss, queue);
    }

    await this.applySchedules(boss);
  }

  /** Dispatch to the handler bound to this job's name. Errors propagate: the caller decides. */
  run<T extends JobName>({ name, data }: JobItem): Promise<JobStatus> {
    const item = this.handlers[name];
    if (!item) {
      // Reachable only for a job enqueued by an older or newer build of the server.
      this.logger.warn(`Skipping unknown job: "${name}"`);
      return Promise.resolve(JobStatus.Skipped);
    }

    return item.handler(data as JobOf<T> as never);
  }

  queue(item: JobItem, options: QueueJobOptions = {}): Promise<void> {
    return this.queueAll([item], options);
  }

  /**
   * Enqueue in bulk, one round trip per queue.
   *
   * Deduplication is a property of the queue policy, so an item that is already pending is
   * silently dropped by the insert rather than rejected. That is what makes a fan-out job safe
   * to run at any time, including while uploads are arriving.
   */
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

  // -- Administration ------------------------------------------------------------------------

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

  /**
   * Stop consuming a queue in **this process**.
   *
   * Deliberately node-local: pg-boss has no server-side pause, and faking a global one with a
   * kondis-owned flag table would be a distributed lock in disguise. Jobs already running are
   * allowed to finish; new ones accumulate in the database until the queue is resumed.
   */
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

  /** Discard everything waiting. Jobs already running are unaffected and will still complete. */
  async empty(queue: QueueName): Promise<void> {
    const boss = await this.getBoss();
    await boss.deleteQueuedJobs(queue);
  }

  /** Discard retained failures and the dead letter backlog. */
  async clearFailed(queue: QueueName): Promise<void> {
    const boss = await this.getBoss();
    await boss.deleteStoredJobs(queue);
    await boss.deleteQueuedJobs(deadLetterName(queue));
    await boss.deleteStoredJobs(deadLetterName(queue));
  }

  /**
   * Block until nothing is running or runnable on the given queues.
   *
   * Intended for tests and for the shutdown path. Polls rather than subscribes because pg-boss
   * has no "queue is idle" signal, and because a poll is correct across processes.
   */
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

  // -- Internals -----------------------------------------------------------------------------

  /**
   * Count one queue by state, exactly.
   *
   * `getQueueStats` would be the obvious call, but it serves a cached reading up to a minute
   * old even when asked to force a refresh. That is fine for a background metric and wrong for
   * an operator who just pressed "empty" and wants to see zero. Aggregating directly is a
   * single indexed query.
   *
   * The cost is a dependency on three pg-boss columns — `name`, `state`, `start_after`. The
   * table name itself is not hard-coded: it comes from `getQueue`, so a queue moved to its own
   * partition still resolves correctly.
   */
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

  /**
   * Per-job queueing behaviour, in one place rather than scattered across producers.
   *
   * Every job on an `exclusive` queue must supply a `singletonKey` — see `QUEUE_POLICY`. The
   * key is prefixed with the job name because the key space is shared by every job on the
   * queue, and two different jobs about the same entity must not suppress each other.
   */
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
    // Started on demand rather than at bootstrap, so a process that only produces jobs (the
    // `api` role) does not need a queue connection to come up, and so generating the OpenAPI
    // schema does not need a database at all.
    this.bossPromise ??= this.createBoss().catch((error: unknown) => {
      // Never cache a rejection: the next caller must be able to retry.
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

      // The dead letter queue must exist before a queue can reference it. Nothing consumes it;
      // it is a durable record of what gave up, and the target of `redrive` once we expose it.
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

  /**
   * Unwrap the stored payload and hand it up.
   *
   * A thrown error propagates into pg-boss, which is what triggers the retry and, eventually,
   * the dead letter. `JobService` is responsible for deciding what counts as unexpected.
   */
  private dispatch(job: Job<StoredJob>): Promise<void> {
    if (!this.onJobRun) {
      throw new Error('Received a job before workers were started');
    }

    return this.onJobRun({ name: job.data.name, data: job.data.data } as JobItem);
  }

  /**
   * Reconcile the stored schedules with `CRON_JOBS`.
   *
   * pg-boss persists schedules, so one removed from the code would otherwise keep firing
   * forever against a job name that may no longer exist. Every schedule is keyed by job name
   * and anything unrecognised is removed.
   */
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
