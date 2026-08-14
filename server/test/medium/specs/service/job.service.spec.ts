import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { JobService } from 'src/services/job.service';
import { QueueCommand, QueueName } from 'src/enum';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(JobService.name, () => {
  let testApp: TestApp;
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  const setup = () => ({ sut: testApp.get(JobService) });

  it('reports every configured queue and handles queue commands', async () => {
    const { sut } = setup();

    const status = await sut.getAllJobStatus();
    expect(Object.keys(status).sort()).toEqual(Object.values(QueueName).sort());

    const paused = await sut.handleCommand(QueueName.Storage, QueueCommand.Pause);
    expect(paused.queueStatus.paused).toBe(true);

    const resumed = await sut.handleCommand(QueueName.Storage, QueueCommand.Resume);
    expect(resumed.queueStatus.paused).toBe(false);
  });
});
