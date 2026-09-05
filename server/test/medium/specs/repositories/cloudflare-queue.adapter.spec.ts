import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudflareQueueTransportAdapter } from 'src/adapters/cloudflare/queue-transport.adapter';
import { CloudflareQueueAdapter } from 'src/adapters/cloudflare/queue.adapter';
import { dispatchUnpublishedJobs, reclaimStaleJobs } from 'src/cloudflare/dispatcher';
import { handleDeadLetterBatch, handleQueueBatch } from 'src/cloudflare/queue-handler';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { HttpStatus, UnsupportedOperationError } from 'src/errors';
import { claimNextPollingJob } from 'src/jobs/polling-job.consumer';
import { JOB_DELIVERY_MESSAGE_VERSION, type JobDeliveryEnvelope } from 'src/ports/job-transport.port';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const upload = (storagePath = 'temporary/activity.gpx'): JobItem => ({
  name: JobName.ActivityUpload,
  data: { originalName: 'activity.gpx', storagePath },
});

describe(CloudflareQueueAdapter.name, () => {
  let db: KondisDatabase;
  let jobs: CloudflareQueueAdapter;

  beforeAll(() => {
    db = createMediumTestDatabase();
    jobs = new CloudflareQueueAdapter(db);
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

  it('persists the cloud consumer so Node jobs never reach Worker queues', async () => {
    await jobs.queueAll([upload(), { name: JobName.AuthCredentialCleanup, data: {} }]);

    const rows = await db.selectFrom('background_job').select(['name', 'consumer']).orderBy('name').execute();
    expect(rows).toEqual([
      { name: JobName.ActivityUpload, consumer: 'node' },
      { name: JobName.AuthCredentialCleanup, consumer: 'worker' },
    ]);
  });

  it('dispatches Worker jobs in a batch and leaves Node jobs for the polling processor', async () => {
    await jobs.queueAll([upload(), { name: JobName.AuthCredentialCleanup, data: {} }]);
    const sent: JobDeliveryEnvelope[] = [];
    const transport = new CloudflareQueueTransportAdapter({
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

    await expect(dispatchUnpublishedJobs(db, transport)).resolves.toBe(1);

    expect(sent).toEqual([
      expect.objectContaining({ queue: QueueName.BackgroundTask, version: JOB_DELIVERY_MESSAGE_VERSION }),
    ]);
    const rows = await db.selectFrom('background_job').select(['consumer', 'published_on']).execute();
    expect(rows.find(({ consumer }) => consumer === 'worker')?.published_on).toBeInstanceOf(Date);
    expect(rows.find(({ consumer }) => consumer === 'node')?.published_on).toBeNull();
  });

  it('does not mark jobs as published when the transport rejects them', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const transport = new CloudflareQueueTransportAdapter({
      [QueueName.BackgroundTask]: {
        send: () => Promise.reject(new Error('transport unavailable')),
      },
    });

    await expect(dispatchUnpublishedJobs(db, transport)).rejects.toThrow('transport unavailable');
    await expect(db.selectFrom('background_job').select('published_on').executeTakeFirstOrThrow()).resolves.toEqual({
      published_on: null,
    });
  });

  it('does not mark jobs as published when a generic publisher rejects them', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });

    await expect(
      dispatchUnpublishedJobs(db, {
        publishBatch: () => Promise.reject(new Error('publisher unavailable')),
      }),
    ).rejects.toThrow('publisher unavailable');
    await expect(db.selectFrom('background_job').select('published_on').executeTakeFirstOrThrow()).resolves.toEqual({
      published_on: null,
    });
  });

  it('publishes through the provider-neutral contract', async () => {
    await jobs.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    const publishBatch = vi.fn((_queue: QueueName, _messages: readonly JobDeliveryEnvelope[]) => Promise.resolve());

    await expect(dispatchUnpublishedJobs(db, { publishBatch })).resolves.toBe(1);

    expect(publishBatch).toHaveBeenCalledWith(QueueName.BackgroundTask, [
      expect.objectContaining({ queue: QueueName.BackgroundTask, version: JOB_DELIVERY_MESSAGE_VERSION }),
    ]);
  });

  it('lets the polling processor claim only Node-owned jobs', async () => {
    await jobs.queueAll([upload(), { name: JobName.AuthCredentialCleanup, data: {} }]);

    await expect(claimNextPollingJob(db, QueueName.BackgroundTask)).resolves.toMatchObject({
      name: JobName.ActivityUpload,
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
    const transport = new CloudflareQueueTransportAdapter();
    const handler = vi.fn(() => Promise.reject(new Error('temporary failure')));

    await handleQueueBatch(
      transport.toDeliveryBatch({ messages: [message] }),
      db,
      { [JobName.AuthCredentialCleanup]: handler },
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
      transport.toDeliveryBatch({ messages: [message] }),
      db,
      { [JobName.AuthCredentialCleanup]: handler },
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

    await expect(reclaimStaleJobs(db)).resolves.toBe(1);
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
    const transport = new CloudflareQueueTransportAdapter();

    await handleQueueBatch(
      transport.toDeliveryBatch({
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
      db,
      { [JobName.AuthCredentialCleanup]: vi.fn(() => Promise.resolve(JobStatus.Success)) },
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
    const transport = new CloudflareQueueTransportAdapter();

    await handleDeadLetterBatch(
      transport.toDeliveryBatch({
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
      db,
      QueueName.BackgroundTask,
    );

    await expect(db.selectFrom('background_job').selectAll().executeTakeFirstOrThrow()).resolves.toMatchObject({
      state: 'dead',
      lease_id: null,
      delete_after: expect.any(Date),
    });
    expect(ack).toHaveBeenCalledOnce();
  });
});
