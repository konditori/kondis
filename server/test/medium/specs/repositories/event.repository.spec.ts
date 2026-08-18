import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type KondisDatabase } from 'src/db/database';
import type { ActivityDto } from 'src/dtos/activity.dto';
import { EventRepository } from 'src/repositories/event.repository';

import { createMediumTestDatabase, getTestDatabaseConfig, resetMediumTestDatabase } from 'test/medium/test-db';

describe(EventRepository.name, () => {
  let db: KondisDatabase;

  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const setup = () => ({ sut: new EventRepository(db, { database: getTestDatabaseConfig() } as never) });

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
