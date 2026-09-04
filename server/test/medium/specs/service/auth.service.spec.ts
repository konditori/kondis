import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CryptoRepository } from 'src/repositories/crypto.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import type { KondisDatabase } from 'src/types';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(AuthService.name, () => {
  let db: KondisDatabase;
  let users: UserRepository;
  let sut: AuthService;

  beforeAll(() => {
    db = createMediumTestDatabase();
    users = new UserRepository(db);
    sut = new AuthService(users, {} as never, new RateLimitingRepository(), new CryptoRepository());
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const setup = () => ({ sut });

  it('creates a user and authenticates with a normalized email', async () => {
    const { sut } = setup();
    const email = `auth-${crypto.randomUUID()}@example.com`;

    const user = await sut.create(email.toUpperCase(), '  Medium', 'User  ', 'a sufficiently long password', 'user');
    const token = await sut.login(email, 'a sufficiently long password');

    expect(user).toMatchObject({ email, first_name: 'Medium', last_name: 'User', role: 'user' });
    expect(token).toMatchObject({
      setup: false,
      user: { id: user.id, email, firstName: 'Medium', lastName: 'User', role: 'user' },
    });
    expect(token.accessToken).toEqual(expect.any(String));
  });

  it('rejects duplicate accounts and invalid credentials', async () => {
    const { sut } = setup();
    const email = `auth-${crypto.randomUUID()}@example.com`;
    await sut.create(email, 'Medium', 'User', 'a sufficiently long password', 'user');

    await expect(
      sut.create(email.toUpperCase(), 'Another', 'User', 'a sufficiently long password', 'user'),
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
    await sut.create(
      `setup-${crypto.randomUUID()}@example.com`,
      'Medium',
      'User',
      'a sufficiently long password',
      'user',
    );
    const after = await sut.setupStatus();

    expect(before.setupRequired).toBe(countBefore === 0);
    expect(after.setupRequired).toBe(false);
  });

  it('rejects an invalid setup token and creates the first administrator with a valid one', async () => {
    const { sut } = setup();
    await db.deleteFrom('user').execute();

    await expect(sut.verifySetupToken('invalid-medium-token')).rejects.toBeInstanceOf(UnauthorizedException);

    const setupToken = (sut as unknown as { setupToken: string }).setupToken;
    const ticket = await sut.verifySetupToken(setupToken);
    const result = await sut.setup(
      `admin-${crypto.randomUUID()}@example.com`,
      'Medium',
      'Admin',
      'a sufficiently long password',
      ticket.token,
    );

    expect(result).toMatchObject({ setup: true, user: { role: 'admin', firstName: 'Medium', lastName: 'Admin' } });
    await expect(sut.setupStatus()).resolves.toEqual({ setupRequired: false });
  });
});
