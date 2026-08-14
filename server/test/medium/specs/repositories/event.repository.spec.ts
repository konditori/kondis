import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ActivityDto } from 'src/dtos/activity.dto';
import { EventRepository } from 'src/repositories/event.repository';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(EventRepository.name, () => {
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

  const setup = () => ({ sut: testApp.get(EventRepository) });

  it('publishes activity events through PostgreSQL notifications', async () => {
    const { sut } = setup();
    const activity = {
      id: crypto.randomUUID(),
      uploadId: crypto.randomUUID(),
      sport: 'run',
      name: 'medium test',
      description: null,
      excludeFromRankings: false,
      startedAt: new Date().toISOString(),
      timezoneOffsetMinutes: 0,
      metrics: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ActivityDto;

    await expect(sut.emit('ActivityCreate', activity)).resolves.toBeUndefined();
  });
});
