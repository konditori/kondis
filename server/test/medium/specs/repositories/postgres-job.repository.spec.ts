import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { handleQueueBatch, toDeliveryBatch } from 'src/cloudflare/job-delivery';
import { JOB_DELIVERY_MESSAGE_VERSION, type JobDeliveryEnvelope } from 'src/contracts/queue.repository';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { HttpStatus, UnsupportedOperationError } from 'src/errors';
import type { JobHandlers } from 'src/jobs/job-handler';
import { CloudflareQueueRepository } from 'src/repositories/cloudflare/cloudflare-queue.repository';
import { NoopRealtimeRepository } from 'src/repositories/noop-realtime.repository';
import { PostgresJobRepository } from 'src/repositories/postgres-job.repository';
import { TakeoutRepository } from 'src/repositories/takeout.repository';
import { JobService } from 'src/services/job.service';
import { PostgresJobService, type PostgresJobServiceOptions } from 'src/services/postgres-job.service';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { newServiceDeps } from 'test/utils';

const upload = (storagePath = 'temporary/activity.gpx'): JobItem => ({
  name: JobName.ActivityUpload,
  data: { originalName: 'activity.gpx', storagePath },
});
const nodeJob: JobItem = {
  name: JobName.ActivityDelete,
  data: { id: '00000000-0000-4000-8000-000000000001' },
};

describe(PostgresJobRepository.name, () => {
  let db: KondisDatabase;
  let jobs: PostgresJobRepository;

  const createService = (handlers: JobHandlers = {}, options: Partial<PostgresJobServiceOptions> = {}) => {
    const realtime = new NoopRealtimeRepository();
    const service = new JobService(newServiceDeps({ jobRepository: jobs, eventRepository: realtime }), handlers);
    return new PostgresJobService(jobs, service.execute.bind(service), {
      hasHandler: service.hasHandler.bind(service),
      realtime,
      takeout: new TakeoutRepository(db),
      ...options,
    });
  };

  beforeAll(() => {
    db = createMediumTestDatabase();
    jobs = new PostgresJobRepository(db);
  });

  beforeEach(() => resetMediumTestDatabase(db));

  afterAll(async () => {
    await db?.destroy();
  });

  it('rolls back a transactional enqueue', async () => {
    await expect(
      db.transaction().execute(async (transaction) => {
        await jobs.queue(upload(), { transaction });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({ queued: 0, total: 0 });
  });

  it('deduplicates singleton jobs and exposes history and temporary references', async () => {
    await jobs.queueAll([upload(), upload()]);

    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({ queued: 1, ready: 1, total: 1 });
    await expect(jobs.getReferencedTemporaryPaths()).resolves.toEqual(new Set(['temporary/activity.gpx']));
    await expect(jobs.getJobHistory(10)).resolves.toMatchObject({ total: 1, jobs: [{ status: 'queued' }] });

    await jobs.discardQueuedDuplicates(JobName.ActivityUpload);
    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({ queued: 0, total: 0 });
  });

  it('reports unsupported queue administration explicitly', async () => {
    await expect(jobs.pause(QueueName.BackgroundTask)).rejects.toBeInstanceOf(UnsupportedOperationError);
    await expect(jobs.empty(QueueName.BackgroundTask)).rejects.toSatisfy(
      (error) => error instanceof UnsupportedOperationError && error.getStatus() === HttpStatus.NOT_IMPLEMENTED,
    );
  });

  it('persists the configured cloud consumer for each job', async () => {
    await jobs.queueAll([upload(), nodeJob, { name: JobName.AuthCredentialCleanup, data: {} }]);

    const rows = await db.selectFrom('background_job').select(['name', 'consumer']).orderBy('name').execute();
    expect(rows).toEqual([
      { name: JobName.ActivityDelete, consumer: 'node' },
      { name: JobName.ActivityUpload, consumer: 'worker' },
      { name: JobName.AuthCredentialCleanup, consumer: 'worker' },
    ]);
  });

  it('dispatches Worker jobs in a batch and leaves Node jobs for the polling processor', async () => {
    await jobs.queueAll([nodeJob, { name: JobName.AuthCredentialCleanup, data: {} }]);
    const sent: JobDeliveryEnvelope[] = [];
    const transport = new CloudflareQueueRepository({
      [QueueName.BackgroundTask]: {
        send: (message) => {
          sent.push(message);
          return Promise.resolve();
        },
        sendBatch: (messages) => {
          sent.push(...Array.from(messages, ({ body }) => body));
          return Promise.resolve();
        },
      },
    });

    await expect(createService({}, { publisher: transport }).dispatchUnpublishedJobs()).resolves.toBe(1);

    expect(sent).toEqual([
      expect.objectContaining({ queue: QueueName.BackgroundTask, version: JOB_DELIVERY_MESSAGE_VERSION }),
    ]);
    const rows = await db.selectFrom('background_job').select(['consumer', 'published_on']).execute();
    expect(rows.find(({ consumer }) => consumer === 'worker')?.published_on).toBeInstanceOf(Date);
    expect(rows.find(({ consumer }) => consumer === 'node')?.published_on).toBeNull();
  });

  it('does not mark jobs as published when the transport rejects them', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const transport = new CloudflareQueueRepository({
      [QueueName.BackgroundTask]: {
        send: () => Promise.reject(new Error('transport unavailable')),
      },
    });

    await expect(createService({}, { publisher: transport }).dispatchUnpublishedJobs()).rejects.toThrow(
      'transport unavailable',
    );
    await expect(db.selectFrom('background_job').select('published_on').executeTakeFirstOrThrow()).resolves.toEqual({
      published_on: null,
    });
  });

  it('does not mark jobs as published when a generic publisher rejects them', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });

    await expect(
      createService(
        {},
        {
          publisher: {
            publishBatch: () => Promise.reject(new Error('publisher unavailable')),
          },
        },
      ).dispatchUnpublishedJobs(),
    ).rejects.toThrow('publisher unavailable');
    await expect(db.selectFrom('background_job').select('published_on').executeTakeFirstOrThrow()).resolves.toEqual({
      published_on: null,
    });
  });

  it('publishes through the provider-neutral contract', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const publishBatch = vi.fn((_queue: QueueName, _messages: readonly JobDeliveryEnvelope[]) => Promise.resolve());

    await expect(createService({}, { publisher: { publishBatch } }).dispatchUnpublishedJobs()).resolves.toBe(1);

    expect(publishBatch).toHaveBeenCalledWith(QueueName.BackgroundTask, [
      expect.objectContaining({ queue: QueueName.BackgroundTask, version: JOB_DELIVERY_MESSAGE_VERSION }),
    ]);
  });

  it('does not publish the same outbox row from concurrent dispatchers', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const publishing = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const publishBatch = vi.fn(async () => {
      started.resolve();
      await publishing.promise;
    });

    const first = createService({}, { publisher: { publishBatch } }).dispatchUnpublishedJobs();
    await started.promise;
    const second = await createService({}, { publisher: { publishBatch } }).dispatchUnpublishedJobs();
    publishing.resolve();

    await expect(first).resolves.toBe(1);
    expect(second).toBe(0);
    expect(publishBatch).toHaveBeenCalledOnce();
  });

  it('does not release a newer dispatch reservation when an older publisher fails', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const publishing = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const first = createService(
      {},
      {
        publisher: {
          publishBatch: () => {
            started.resolve();
            return publishing.promise;
          },
        },
      },
    ).dispatchUnpublishedJobs();
    // Attach the rejection assertion before resolving the failing publication.
    const failed = expect(first).rejects.toThrow('old publication failed');
    await started.promise;
    const old = await db.selectFrom('background_job').select('dispatch_token').executeTakeFirstOrThrow();
    await db
      .updateTable('background_job')
      .set({ published_on: new Date(0) })
      .execute();
    await jobs.recoverOrphanedPublishedJobs(300);
    await createService({}, { publisher: { publishBatch: () => Promise.resolve() } }).dispatchUnpublishedJobs();
    publishing.reject(new Error('old publication failed'));
    await failed;

    const current = await db
      .selectFrom('background_job')
      .select(['dispatch_token', 'published_on'])
      .executeTakeFirstOrThrow();
    expect(current.dispatch_token).not.toBe(old.dispatch_token);
    expect(current.dispatch_token).not.toBeNull();
    expect(current.published_on).toBeInstanceOf(Date);
  });

  it('rejects completion and failure from an execution that has lost its lease', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const { id } = await db.selectFrom('background_job').select('id').executeTakeFirstOrThrow();
    const previous = (await jobs.claimDeliveredJob(id, QueueName.BackgroundTask))!;
    await db
      .updateTable('background_job')
      .set({ lease_expires_at: new Date(0) })
      .execute();
    await jobs.reclaimStaleJobs();
    await db
      .updateTable('background_job')
      .set({ start_after: new Date(0) })
      .execute();
    const current = (await jobs.claimDeliveredJob(id, QueueName.BackgroundTask))!;

    expect(current.lease_id).not.toBe(previous.lease_id);
    await expect(jobs.complete(previous, JobStatus.Success)).resolves.toBe(false);
    await expect(
      jobs.recordFailure(previous, { exhausted: true, retryCount: 4, delaySeconds: 40 }, 'late failure', true),
    ).resolves.toBe(false);
    await expect(jobs.complete(current, JobStatus.Success)).resolves.toBe(true);
  });

  it('claims duplicate Queue deliveries only once', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const row = await db.selectFrom('background_job').select('id').executeTakeFirstOrThrow();
    const ack = vi.fn();
    const handler = vi.fn(() => Promise.resolve(JobStatus.Success));
    const delivery = {
      payload: { jobId: row.id, queue: QueueName.BackgroundTask, version: JOB_DELIVERY_MESSAGE_VERSION },
      acknowledge: ack,
      retry: vi.fn(),
    };

    await handleQueueBatch(
      createService({ [JobName.AuthCredentialCleanup]: handler }),
      { deliveries: [delivery, delivery] },
      QueueName.BackgroundTask,
    );

    expect(handler).toHaveBeenCalledOnce();
    expect(ack).toHaveBeenCalledTimes(2);
  });

  it('allows simultaneous polling claims for distinct jobs in one queue', async () => {
    await jobs.queueAll([
      nodeJob,
      { name: JobName.ActivityDelete, data: { id: '00000000-0000-4000-8000-000000000002' } },
    ]);

    const claimed = await Promise.all([
      jobs.claimNextJob(QueueName.BackgroundTask),
      jobs.claimNextJob(QueueName.BackgroundTask),
    ]);

    expect(claimed.map((job) => job?.id)).toEqual([expect.any(String), expect.any(String)]);
    expect(new Set(claimed.map((job) => job?.id)).size).toBe(2);
  });

  it('lets the polling processor claim only Node-owned jobs', async () => {
    await jobs.queueAll([nodeJob, { name: JobName.AuthCredentialCleanup, data: {} }]);

    await expect(jobs.claimNextJob(QueueName.BackgroundTask)).resolves.toMatchObject({
      name: JobName.ActivityDelete,
      queue: QueueName.BackgroundTask,
      lease_id: expect.any(String),
    });
    const workerJob = await db
      .selectFrom('background_job')
      .select(['state', 'lease_id'])
      .where('consumer', '=', 'worker')
      .executeTakeFirstOrThrow();
    expect(workerJob).toEqual({ state: 'created', lease_id: null });
  });

  it('synchronously drains jobs created by other jobs to completion', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const cleanup = vi.fn(async () => {
      await jobs.queue(nodeJob);
      return JobStatus.Success;
    });
    const removeActivity = vi.fn(() => Promise.resolve(JobStatus.Success));
    const consumer = createService(
      {
        [JobName.AuthCredentialCleanup]: cleanup,
        [JobName.ActivityDelete]: removeActivity,
      },
      { consumers: ['node', 'worker'] },
    );

    await expect(consumer.drain(QueueName.BackgroundTask)).resolves.toBe(2);

    expect(cleanup).toHaveBeenCalledOnce();
    expect(removeActivity).toHaveBeenCalledOnce();
    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({
      active: 0,
      queued: 0,
      failed: 0,
      total: 2,
    });
  });

  it('retries handler failures through the outbox and exhausts the configured retry limit', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const row = await db.selectFrom('background_job').select('id').executeTakeFirstOrThrow();
    const ack = vi.fn();
    const retry = vi.fn();
    const message = {
      body: {
        jobId: row.id,
        queue: QueueName.BackgroundTask,
        version: JOB_DELIVERY_MESSAGE_VERSION,
      },
      ack,
      retry,
    };
    const handler = vi.fn(() => Promise.reject(new Error('temporary failure')));

    await handleQueueBatch(
      createService({ [JobName.AuthCredentialCleanup]: handler }),
      toDeliveryBatch({ messages: [message] }),
      QueueName.BackgroundTask,
    );

    await expect(db.selectFrom('background_job').selectAll().executeTakeFirstOrThrow()).resolves.toMatchObject({
      state: 'retry',
      retry_count: 1,
      published_on: null,
      lease_id: null,
    });
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();

    await db
      .updateTable('background_job')
      .set({ retry_count: 3, start_after: new Date(0) })
      .execute();
    await handleQueueBatch(
      createService({ [JobName.AuthCredentialCleanup]: handler }),
      toDeliveryBatch({ messages: [message] }),
      QueueName.BackgroundTask,
    );
    await expect(db.selectFrom('background_job').selectAll().executeTakeFirstOrThrow()).resolves.toMatchObject({
      state: 'failed',
      retry_count: 4,
      lease_id: null,
      delete_after: expect.any(Date),
    });
  });

  it('fences an expired lease and counts it against the retry limit', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    await db
      .updateTable('background_job')
      .set({
        state: 'active',
        lease_id: crypto.randomUUID(),
        lease_expires_at: new Date(0),
        retry_count: 3,
        started_on: new Date(0),
      })
      .execute();

    await expect(createService().reclaimStaleJobs()).resolves.toBe(1);
    await expect(db.selectFrom('background_job').selectAll().executeTakeFirstOrThrow()).resolves.toMatchObject({
      state: 'failed',
      retry_count: 4,
      lease_id: null,
      lease_expires_at: null,
    });
  });

  it('records successful Worker jobs with a fenced completion and retention deadline', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const row = await db.selectFrom('background_job').select('id').executeTakeFirstOrThrow();
    const ack = vi.fn();
    await handleQueueBatch(
      createService({ [JobName.AuthCredentialCleanup]: vi.fn(() => Promise.resolve(JobStatus.Success)) }),
      toDeliveryBatch({
        messages: [
          {
            body: {
              jobId: row.id,
              queue: QueueName.BackgroundTask,
              version: JOB_DELIVERY_MESSAGE_VERSION,
            },
            ack,
            retry: vi.fn(),
          },
        ],
      }),
      QueueName.BackgroundTask,
    );

    await expect(db.selectFrom('background_job').selectAll().executeTakeFirstOrThrow()).resolves.toMatchObject({
      state: 'completed',
      output: { status: JobStatus.Success },
      lease_id: null,
      delete_after: expect.any(Date),
    });
    expect(ack).toHaveBeenCalledOnce();
  });

  it('adapts a Cloudflare dead-letter delivery and records its terminal state', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const row = await db.selectFrom('background_job').select('id').executeTakeFirstOrThrow();
    const ack = vi.fn();
    await handleQueueBatch(
      createService(),
      toDeliveryBatch({
        messages: [
          {
            body: {
              jobId: row.id,
              queue: QueueName.BackgroundTask,
              version: JOB_DELIVERY_MESSAGE_VERSION,
            },
            ack,
            retry: vi.fn(),
          },
        ],
      }),
      QueueName.BackgroundTask,
      true,
    );

    await expect(db.selectFrom('background_job').selectAll().executeTakeFirstOrThrow()).resolves.toMatchObject({
      state: 'dead',
      lease_id: null,
      delete_after: expect.any(Date),
    });
    expect(ack).toHaveBeenCalledOnce();
  });
});
