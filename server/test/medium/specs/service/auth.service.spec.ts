import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type KondisDatabase } from 'src/db/database';
import { AuthService } from 'src/services/auth.service';
import { UserRepository } from 'src/repositories/user.repository';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(AuthService.name, () => {
  let db: KondisDatabase;
  let users: UserRepository;
  let sut: AuthService;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    users = new UserRepository(db);
    sut = new AuthService(users, { authSecret: 'medium-test-secret' } as never);
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const setup = () => ({ sut });

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
    const countResult = await users.count();
    const countBefore = Number(countResult.count);
    const before = await sut.setupStatus();
    await sut.create(`setup-${crypto.randomUUID()}@example.com`, 'Medium User', 'a sufficiently long password', 'user');
    const after = await sut.setupStatus();

    expect(before.setupRequired).toBe(countBefore === 0);
    expect(after.setupRequired).toBe(false);
  });
});
