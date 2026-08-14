import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ActivityRepository } from 'src/repositories/activity.repository';

import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(ActivityRepository.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(async () => {
    db = createMediumTestDatabase();
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const setup = () => ({ sut: new ActivityRepository(db), factory: createMediumFactory(db) });

  it('creates, reads, updates, and deletes an activity', async () => {
    const { sut, factory } = setup();
    const user = await factory.newUser();
    const id = await factory.newActivity(user.id, new Date('2024-01-01T08:00:00Z'), 'morning run');

    await expect(sut.getById(id, user.id)).resolves.toMatchObject({ id, name: 'morning run' });
    await expect(sut.update(id, { name: 'updated run' }, user.id)).resolves.toMatchObject({ name: 'updated run' });
    await expect(sut.listRecentPage({ limit: 10, userId: user.id })).resolves.toHaveLength(1);

    await sut.delete(id);
    await expect(sut.getById(id, user.id)).resolves.toBeUndefined();
  });

  it('keeps users isolated when listing activities', async () => {
    const { sut, factory } = setup();
    const owner = await factory.newUser();
    const other = await factory.newUser();
    await factory.newActivity(owner.id, new Date('2024-01-01T08:00:00Z'), 'owner activity');
    await factory.newActivity(other.id, new Date('2024-01-02T08:00:00Z'), 'other activity');

    const page = await sut.listRecentPage({ limit: 10, userId: owner.id });
    expect(page).toHaveLength(1);
    expect(page[0]?.name).toBe('owner activity');
  });
});
