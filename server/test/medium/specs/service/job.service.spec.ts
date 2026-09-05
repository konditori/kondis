import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { QueueCommand, QueueName } from 'src/enum';
import { ConsoleLogger } from 'src/logger';
import type { JobAdminPort, JobConsumerPort, JobProducerPort } from 'src/ports/queue.port';
import { JobService } from 'src/services/job.service';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const emptyCounts = () => ({ queued: 0, ready: 0, deferred: 0, active: 0, failed: 0, total: 0 });

const makeJobService = () => {
  const paused = new Set<QueueName>();
  const jobs = {
    getAllJobCounts: () =>
      Promise.resolve(
        Object.fromEntries(Object.values(QueueName).map((queue) => [queue, emptyCounts()])) as Record<
          QueueName,
          ReturnType<typeof emptyCounts>
        >,
      ),
    getJobCounts: () => Promise.resolve(emptyCounts()),
    isPaused: (queue: QueueName) => paused.has(queue),
    pause: (queue: QueueName) => void paused.add(queue),
    resume: (queue: QueueName) => void paused.delete(queue),
  } as unknown as JobProducerPort & JobAdminPort & JobConsumerPort;
  const events = { emit: () => {} } as never;
  return {
    sut: new JobService({ admin: jobs, consumer: jobs, producer: jobs }, events, new ConsoleLogger()),
  };
};

describe(JobService.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(() => {
    db = createMediumTestDatabase();
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  it('reports every configured queue and handles queue commands', async () => {
    const { sut } = makeJobService();

    const status = await sut.getAllJobStatus();
    expect(Object.keys(status).sort()).toEqual(Object.values(QueueName).sort());

    const paused = await sut.handleCommand(QueueName.Storage, QueueCommand.Pause);
    expect(paused.queueStatus.paused).toBe(true);

    const resumed = await sut.handleCommand(QueueName.Storage, QueueCommand.Resume);
    expect(resumed.queueStatus.paused).toBe(false);
  });
});
