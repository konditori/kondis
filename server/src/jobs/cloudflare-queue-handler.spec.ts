import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPortableWorkerHandlers, handleQueueBatch } from 'src/cloudflare/queue-handler';
import { JobName, QueueName } from 'src/enum';
import { CLOUD_JOB_CONSUMER } from 'src/jobs/job-semantics';
import type { KondisDatabase } from 'src/types';

describe(handleQueueBatch.name, () => {
  afterEach(() => vi.restoreAllMocks());

  it('acknowledges poison messages without touching the database', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const ack = vi.fn();
    const retry = vi.fn();

    await handleQueueBatch(
      {
        deliveries: [{ payload: { jobId: 'not-a-uuid', version: 1 }, acknowledge: ack, retry }],
      },
      {} as KondisDatabase,
      {},
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
      {} as KondisDatabase,
      {},
      QueueName.BackgroundTask,
    );

    expect(retry).toHaveBeenCalledOnce();
    expect(ack).not.toHaveBeenCalled();
  });

  it('registers exactly the Worker-owned handler subset', () => {
    const handlers = createPortableWorkerHandlers({} as KondisDatabase);

    expect(Object.keys(handlers).sort()).toEqual(
      Object.values(JobName)
        .filter((jobName) => CLOUD_JOB_CONSUMER[jobName] === 'worker')
        .sort(),
    );
  });
});
