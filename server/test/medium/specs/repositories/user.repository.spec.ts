import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserRepository } from 'src/repositories/user.repository';

import { createMediumFactory } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(UserRepository.name, () => {
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

  const setup = () => ({ sut: testApp.get(UserRepository), factory: createMediumFactory(testApp) });

  it('creates, counts, and finds users', async () => {
    const { sut, factory } = setup();
    const before = await sut.count();
    const user = await factory.newUser({ email: 'repository@example.com' });

    await expect(sut.count()).resolves.toMatchObject({ count: Number(before.count) + 1 });
    await expect(sut.findById(user.id)).resolves.toMatchObject({ email: 'repository@example.com' });
    await expect(sut.findByEmail('repository@example.com')).resolves.toMatchObject({ id: user.id });
    await expect(sut.all()).resolves.toContainEqual(expect.objectContaining({ id: user.id }));
  });
});
