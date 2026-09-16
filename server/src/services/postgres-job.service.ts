import {
  JOB_DELIVERY_MESSAGE_VERSION,
  type JobDeliveryEnvelope,
  type QueueRepository,
} from 'src/contracts/queue.repository';
import type { RealtimeRepository } from 'src/contracts/realtime.repository';
import { JobName, JobStatus, QueueName } from 'src/enum';
import type { JobExecutor } from 'src/jobs/job-handler';
import {
  CRON_JOBS,
  JOB_CONCURRENCY,
  JOB_EXPIRE_SECONDS,
  getJobFailureTransition,
  type CloudJobConsumer,
} from 'src/jobs/job-semantics';
import type { ClaimedJob, DispatchClaim, PostgresJobRepository } from 'src/repositories/postgres-job.repository';
import type { TakeoutRepository } from 'src/repositories/takeout.repository';
import type { JobItem } from 'src/types/jobs';
import { asErrorMessage } from 'src/utils/misc';

const MAX_DISPATCH_BATCH_SIZE = 100;
const MAX_DISPATCH_BATCHES_PER_INVOCATION = 10;
const PUBLISHED_MESSAGE_TIMEOUT_SECONDS = 5 * 60;
const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const storedError = (error: unknown): string => asErrorMessage(error).slice(0, 4096);
const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

export type JobDeliveryOutcome = { action: 'acknowledge' | 'retry'; changed: boolean };
export type PostgresJobServiceOptions = {
  publisher?: QueueRepository;
  realtime?: RealtimeRepository;
  takeout?: Pick<TakeoutRepository, 'failJobItem'>;
  hasHandler: (name: JobName) => boolean;
  consumers?: readonly CloudJobConsumer[];
  concurrency?: Partial<Record<QueueName, number>>;
  leaseHeartbeatMs?: number;
  pollIntervalMs?: number;
  logger?: Pick<Console, 'log' | 'error' | 'warn'>;
};

const parseMessage = (body: unknown): JobDeliveryEnvelope | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const value = body as Record<string, unknown>;
  if (
    value.version !== JOB_DELIVERY_MESSAGE_VERSION ||
    typeof value.jobId !== 'string' ||
    !UUID_PATTERN.test(value.jobId) ||
    typeof value.queue !== 'string' ||
    !Object.values(QueueName).includes(value.queue as QueueName)
  ) {
    return undefined;
  }
  return value as JobDeliveryEnvelope;
};

/**
 * Coordinates the custom job backend for Queue delivery and Node polling.
 */
export class PostgresJobService {
  private running = false;
  private notifyPolling = false;
  private loopPromises: Promise<void>[] = [];

  constructor(
    private readonly jobs: PostgresJobRepository,
    private readonly execute: JobExecutor,
    private readonly options: PostgresJobServiceOptions,
  ) {}

  async dispatchUnpublishedJobs(limit = MAX_DISPATCH_BATCH_SIZE): Promise<number> {
    const publisher = this.options.publisher;
    if (!publisher) {
      throw new Error('A queue repository is required to dispatch jobs');
    }
    const requestedLimit = Number.isFinite(limit) ? Math.trunc(limit) : MAX_DISPATCH_BATCH_SIZE;
    const claims = await this.jobs.claimForDispatch(Math.max(1, Math.min(requestedLimit, MAX_DISPATCH_BATCH_SIZE)));
    const byQueue = new Map<QueueName, DispatchClaim[]>();
    for (const job of claims) {
      const jobs = byQueue.get(job.queue) ?? [];
      jobs.push(job);
      byQueue.set(job.queue, jobs);
    }
    let dispatched = 0;
    for (const [queue, jobs] of byQueue) {
      const messages = jobs.map(({ id }): JobDeliveryEnvelope => ({
        jobId: id,
        queue,
        version: JOB_DELIVERY_MESSAGE_VERSION,
      }));
      try {
        await publisher.publishBatch(queue, messages);
      } catch (error) {
        await this.jobs.releaseDispatchClaims(jobs);
        throw error;
      }
      dispatched += jobs.length;
    }
    return dispatched;
  }

  async drainUnpublishedJobs(): Promise<number> {
    let total = 0;
    for (let batch = 0; batch < MAX_DISPATCH_BATCHES_PER_INVOCATION; batch += 1) {
      const dispatched = await this.dispatchUnpublishedJobs();
      total += dispatched;
      if (dispatched < MAX_DISPATCH_BATCH_SIZE) {
        break;
      }
    }
    return total;
  }

  async reclaimStaleJobs(): Promise<number> {
    const rows = await this.jobs.reclaimStaleJobs();
    for (const row of rows) {
      if (row.exhausted) {
        await this.failImportItem(row.payload, 'Job lease expired; retry limit exhausted');
      }
    }
    return rows.length;
  }

  async runScheduledCron(cron: string): Promise<boolean> {
    if (cron === '* * * * *') {
      const reclaimed = await this.reclaimStaleJobs();
      await this.jobs.recoverOrphanedPublishedJobs(PUBLISHED_MESSAGE_TIMEOUT_SECONDS);
      await this.jobs.purgeExpiredJobs();
      await this.drainUnpublishedJobs();
      if (reclaimed > 0) {
        await this.notifyJobUpdates();
      }
      return true;
    }
    const schedule = CRON_JOBS.find((candidate) => candidate.cron === cron);
    if (!schedule) {
      return false;
    }
    await this.jobs.queue(schedule.item);
    return true;
  }

  async handleDelivery(payload: unknown, expectedQueue: QueueName): Promise<JobDeliveryOutcome> {
    const body = parseMessage(payload);
    if (!body) {
      console.error('Discarding a malformed job delivery');
      return { action: 'acknowledge', changed: false };
    }
    if (body.queue !== expectedQueue) {
      console.error(`Queue message for ${body.queue} was delivered to ${expectedQueue}`);
      return { action: 'retry', changed: false };
    }
    const job = await this.jobs.claimDeliveredJob(body.jobId, expectedQueue);
    if (!job) {
      // Duplicate/early deliveries may be acknowledged after releasing a pending publication.
      await this.jobs.releaseUnclaimedDelivery(body.jobId, expectedQueue);
      return { action: 'acknowledge', changed: false };
    }
    if (!this.options.hasHandler(job.name as JobName)) {
      const message = `No Worker handler registered for job ${job.name}`;
      await this.jobs.failPermanently(job, message);
      await this.failImportItem(job.payload, message);
      return { action: 'acknowledge', changed: true };
    }
    await this.process(job, 'delivery');
    // Retry state is persisted before ack; Queue transport retries must not race job retries.
    return { action: 'acknowledge', changed: true };
  }

  async handleDeadLetter(payload: unknown, expectedQueue: QueueName): Promise<JobDeliveryOutcome> {
    const body = parseMessage(payload);
    if (!body || body.queue !== expectedQueue) {
      console.error('Discarding a malformed or misrouted dead-letter message');
      return { action: 'acknowledge', changed: false };
    }
    const rows = await this.jobs.markDead(body.jobId, expectedQueue);
    for (const row of rows) {
      await this.failImportItem(row.payload, 'Queue delivery exhausted');
    }
    return { action: 'acknowledge', changed: true };
  }

  async notifyJobUpdates(): Promise<void> {
    await this.options.realtime?.emit('JobUpdated');
  }

  start(): Promise<void> {
    if (this.running) {
      return Promise.resolve();
    }
    this.running = true;
    this.notifyPolling = true;
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

  async drain(...queues: QueueName[]): Promise<number> {
    if (this.running) {
      throw new Error('Cannot synchronously drain polling jobs while workers are running');
    }
    const names = queues.length > 0 ? queues : Object.values(QueueName);
    let processed = 0;
    for (;;) {
      let found = false;
      for (const queue of names) {
        const job = await this.jobs.claimNextJob(queue, this.options.consumers);
        if (!job) {
          continue;
        }
        found = true;
        processed += 1;
        this.options.logger?.log(`Claimed ${job.name} (${job.id}) from ${queue}`);
        await this.process(job, 'polling');
      }
      if (!found) {
        return processed;
      }
    }
  }

  private queueConcurrency(queue: QueueName): number {
    return Math.max(1, Math.trunc(this.options.concurrency?.[queue] ?? JOB_CONCURRENCY[queue]));
  }

  private async consume(queue: QueueName): Promise<void> {
    const interval = this.options.pollIntervalMs ?? 1000;
    while (this.running) {
      try {
        const job = await this.jobs.claimNextJob(queue, this.options.consumers);
        if (!job) {
          await sleep(interval);
          continue;
        }
        this.options.logger?.log(`Claimed ${job.name} (${job.id}) from ${queue}`);
        await this.process(job, 'polling');
      } catch (error) {
        this.options.logger?.error(`Polling job consumer failed for ${queue}: ${asErrorMessage(error)}`);
        await sleep(interval);
      }
    }
  }

  private async process(job: ClaimedJob, source: 'delivery' | 'polling'): Promise<void> {
    const stopHeartbeat = source === 'polling' ? this.startLeaseHeartbeat(job) : undefined;
    try {
      let status: JobStatus;
      try {
        status = await this.execute(job.payload as JobItem, { notify: source === 'polling' && this.notifyPolling });
      } catch (error) {
        const transition = getJobFailureTransition(job.retry_count, job.retry_limit);
        const updated = await this.jobs.recordFailure(job, transition, storedError(error), source === 'delivery');
        if (updated && source === 'delivery' && transition.exhausted) {
          // Preserve existing delivery/polling behavior; unifying takeout reporting is a separate change.
          await this.failImportItem(job.payload, storedError(error));
        }
        if (updated) {
          return;
        }
        this.options.logger?.warn(`Job ${job.id} failed after losing its lease; failure was ignored`);
        return;
      }
      const updated = await this.jobs.complete(job, status);
      if (updated) {
        this.options.logger?.log(`Completed ${job.name} (${job.id}) with status ${status}`);
      } else {
        this.options.logger?.warn(`Job ${job.id} completed after losing its lease; result was ignored`);
      }
    } finally {
      stopHeartbeat?.();
    }
  }

  private startLeaseHeartbeat(job: ClaimedJob): () => void {
    const interval = this.options.leaseHeartbeatMs ?? Math.max(1000, (JOB_EXPIRE_SECONDS * 1000) / 3);
    let updating = false;
    const timer = setInterval(() => {
      if (updating) {
        return;
      }
      updating = true;
      void this.jobs
        .renewLease(job)
        .catch((error: unknown) =>
          this.options.logger?.warn(`Could not renew lease for polling job ${job.id}: ${asErrorMessage(error)}`),
        )
        .finally(() => {
          updating = false;
        });
    }, interval);
    // Node timers expose unref; Worker timers are numbers.
    (timer as unknown as { unref?: () => void }).unref?.();
    return () => clearInterval(timer);
  }

  private async failImportItem(payload: { data?: object }, message: string): Promise<void> {
    const data = payload.data as { takeoutImportId?: unknown; takeoutItemKey?: unknown } | undefined;
    if (typeof data?.takeoutImportId === 'string' && typeof data.takeoutItemKey === 'string') {
      await this.options.takeout?.failJobItem(data.takeoutImportId, data.takeoutItemKey, message);
    }
  }
}
