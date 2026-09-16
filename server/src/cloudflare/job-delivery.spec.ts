import { afterEach, describe, expect, it, vi } from 'vitest';

import { handleQueueBatch } from 'src/cloudflare/job-delivery';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { createWorkerJobHandlers } from 'src/job-handler.registry.worker';
import { CLOUD_JOB_CONSUMER } from 'src/jobs/job-semantics';
import type { ClaimedJob, PostgresJobRepository } from 'src/repositories/postgres-job.repository';
import { PostgresJobService } from 'src/services/postgres-job.service';

const service = () => new PostgresJobService({} as PostgresJobRepository, vi.fn(), { hasHandler: () => false });

describe(handleQueueBatch.name, () => {
  afterEach(() => vi.restoreAllMocks());

  it('acknowledges poison messages without touching the database', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ack = vi.fn();
    const retry = vi.fn();

    await handleQueueBatch(
      service(),
      {
        deliveries: [{ payload: { jobId: 'not-a-uuid', version: 1 }, acknowledge: ack, retry }],
      },
      QueueName.Storage,
    );

    expect(ack).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
  });

  it('retries messages delivered through the wrong logical queue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ack = vi.fn();
    const retry = vi.fn();

    await handleQueueBatch(
      service(),
      {
        deliveries: [
          {
            payload: {
              jobId: 'ba5eba11-0000-4000-a000-000000000000',
              queue: QueueName.Storage,
              version: 1,
            },
            acknowledge: ack,
            retry,
          },
        ],
      },
      QueueName.BackgroundTask,
    );

    expect(retry).toHaveBeenCalledOnce();
    expect(ack).not.toHaveBeenCalled();
  });

  it('registers exactly the Worker-owned handler subset', () => {
    const handlers = createWorkerJobHandlers({
      authService: {
        handleCredentialCleanup: () => Promise.resolve(JobStatus.Success),
      },
    });

    expect(Object.keys(handlers).sort()).toEqual(
      Object.values(JobName)
        .filter((jobName) => CLOUD_JOB_CONSUMER[jobName] === 'worker')
        .sort(),
    );
  });

  it.each(['complete', 'recordFailure'] as const)('does not acknowledge if persisting %s fails', async (operation) => {
    const job: ClaimedJob = {
      id: 'ba5eba11-0000-4000-a000-000000000000',
      queue: QueueName.BackgroundTask,
      name: JobName.AuthCredentialCleanup,
      payload: { name: JobName.AuthCredentialCleanup, data: {} },
      state: 'active',
      retry_count: 0,
      retry_limit: 3,
      consumer: 'worker',
      lease_id: 'lease',
    };
    const complete = vi.fn(() => Promise.resolve(true));
    const recordFailure = vi.fn(() => Promise.resolve(true));
    const jobs = {
      claimDeliveredJob: vi.fn(() => Promise.resolve(job)),
      complete,
      recordFailure,
    } as unknown as PostgresJobRepository;
    const execute = vi.fn(() =>
      operation === 'recordFailure' ? Promise.reject(new Error('handler failed')) : Promise.resolve(JobStatus.Success),
    );
    ({ complete, recordFailure })[operation].mockRejectedValue(new Error('database unavailable'));
    const service = new PostgresJobService(jobs, execute, { hasHandler: () => true });
    const acknowledge = vi.fn();
    const retry = vi.fn();

    await expect(
      handleQueueBatch(
        service,
        {
          deliveries: [
            {
              payload: { jobId: job.id, queue: job.queue, version: 1 },
              acknowledge,
              retry,
            },
          ],
        },
        QueueName.BackgroundTask,
      ),
    ).rejects.toThrow('database unavailable');

    expect(acknowledge).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  });

  it('acknowledges a handler failure only after the retry has been persisted', async () => {
    const persisted = Promise.withResolvers<boolean>();
    const job = {
      id: 'ba5eba11-0000-4000-a000-000000000000',
      name: JobName.AuthCredentialCleanup,
      payload: { name: JobName.AuthCredentialCleanup, data: {} },
      retry_count: 0,
      retry_limit: 3,
    } as ClaimedJob;
    const recordFailure = vi.fn(() => persisted.promise);
    const jobs = {
      claimDeliveredJob: () => Promise.resolve(job),
      recordFailure,
    } as unknown as PostgresJobRepository;
    const service = new PostgresJobService(jobs, () => Promise.reject(new Error('temporary failure')), {
      hasHandler: () => true,
    });
    const acknowledge = vi.fn();
    const retry = vi.fn();
    const delivery = handleQueueBatch(
      service,
      {
        deliveries: [
          {
            payload: { jobId: job.id, queue: QueueName.BackgroundTask, version: 1 },
            acknowledge,
            retry,
          },
        ],
      },
      QueueName.BackgroundTask,
    );

    await vi.waitFor(() => expect(recordFailure).toHaveBeenCalledOnce());
    expect(acknowledge).not.toHaveBeenCalled();
    persisted.resolve(true);
    await delivery;
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(retry).not.toHaveBeenCalled();
  });
});
