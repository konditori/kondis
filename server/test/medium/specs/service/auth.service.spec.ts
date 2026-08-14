import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from 'src/services/auth.service';
import { UserRepository } from 'src/repositories/user.repository';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(AuthService.name, () => {
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

  const setup = () => ({ sut: testApp.get(AuthService) });

  it('creates a user and authenticates with a normalized email', async () => {
    const { sut } = setup();
    const email = `auth-${crypto.randomUUID()}@example.com`;

    const user = await sut.create(email.toUpperCase(), '  Medium User  ', 'a sufficiently long password', 'user');
    const token = await sut.login(email, 'a sufficiently long password');

    expect(user).toMatchObject({ email, name: 'Medium User', role: 'user' });
    expect(token).toMatchObject({
      setup: false,
      user: { id: user.id, email, name: 'Medium User', role: 'user' },
    });
    expect(token.accessToken).toEqual(expect.any(String));
  });

  it('rejects duplicate accounts and invalid credentials', async () => {
    const { sut } = setup();
    const email = `auth-${crypto.randomUUID()}@example.com`;
    await sut.create(email, 'Medium User', 'a sufficiently long password', 'user');

    await expect(
      sut.create(email.toUpperCase(), 'Another User', 'a sufficiently long password', 'user'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(sut.login(email, 'wrong password')).rejects.toThrow('Invalid email or password');
    await expect(sut.login(`missing-${email}`, 'a sufficiently long password')).rejects.toThrow(
      'Invalid email or password',
    );
  });

  it('reports whether initial setup is required', async () => {
    const { sut } = setup();
    const users = testApp.get(UserRepository);
    const countResult = await users.count();
    const countBefore = Number(countResult.count);
    const before = await sut.setupStatus();
    await sut.create(`setup-${crypto.randomUUID()}@example.com`, 'Medium User', 'a sufficiently long password', 'user');
    const after = await sut.setupStatus();

    expect(before.setupRequired).toBe(countBefore === 0);
    expect(after.setupRequired).toBe(false);
  });
});
