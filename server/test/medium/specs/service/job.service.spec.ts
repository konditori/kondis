import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConsoleLogger } from '@nestjs/common';
import { QueueCommand, QueueName } from 'src/enum';
import type { JobRepository } from 'src/repositories/job.repository';
import { JobService } from 'src/services/job.service';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const makeJobService = () => {
  const paused = new Set<QueueName>();
  const jobs = {
    getJobCounts: () => ({ queued: 0, active: 0, completed: 0, failed: 0, total: 0 }),
    isPaused: (queue: QueueName) => paused.has(queue),
    pause: (queue: QueueName) => void paused.add(queue),
    resume: (queue: QueueName) => void paused.delete(queue),
  } as unknown as JobRepository;
  const events = { emit: async () => undefined } as never;
  return {
    sut: new JobService({ hasWorker: () => false } as never, jobs, events, new ConsoleLogger()),
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
