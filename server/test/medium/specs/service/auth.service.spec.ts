import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserRole } from 'src/enum';
import { ConflictException, UnauthorizedException } from 'src/errors';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import { SessionRepository } from 'src/repositories/session.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import type { KondisDatabase } from 'src/types';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(AuthService.name, () => {
  let db: KondisDatabase;
  let credentials: SessionRepository;
  let users: UserRepository;
  let sut: AuthService;

  beforeAll(() => {
    db = createMediumTestDatabase();
    credentials = new SessionRepository(db);
    users = new UserRepository(db);
    sut = new AuthService(
      users,
      {} as never,
      new RateLimitingRepository(db),
      new CryptoRepository(),
      credentials,
      { emit: () => Promise.resolve() } as never,
      new DatabaseRepository(db),
    );
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  const setup = () => ({ sut });

  it('creates a user and authenticates with a normalized email', async () => {
    const { sut } = setup();
    const email = `auth-${crypto.randomUUID()}@example.com`;

    const user = await sut.create(
      email.toUpperCase(),
      '  Medium',
      'User  ',
      'a sufficiently long password',
      UserRole.User,
    );
    const token = await sut.login(email, 'a sufficiently long password');

    expect(user).toMatchObject({ email, first_name: 'Medium', last_name: 'User', role: UserRole.User });
    expect(token).toMatchObject({
      setup: false,
      user: { id: user.id, email, firstName: 'Medium', lastName: 'User', role: UserRole.User },
    });
    expect(token.accessToken).toEqual(expect.any(String));
  });

  it('rejects duplicate accounts and invalid credentials', async () => {
    const { sut } = setup();
    const email = `auth-${crypto.randomUUID()}@example.com`;
    await sut.create(email, 'Medium', 'User', 'a sufficiently long password', UserRole.User);

    await expect(
      sut.create(email.toUpperCase(), 'Another', 'User', 'a sufficiently long password', UserRole.User),
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
      UserRole.User,
    );
    const after = await sut.setupStatus();

    expect(before.setupRequired).toBe(countBefore === 0);
    expect(after.setupRequired).toBe(false);
  });

  it('rejects an invalid setup token and creates the first administrator with a valid one', async () => {
    const { sut } = setup();
    await db.deleteFrom('user').execute();

    await expect(sut.verifySetupToken('invalid-medium-token')).rejects.toBeInstanceOf(UnauthorizedException);

    const setupToken = await credentials.getOrCreateSetupToken();
    const ticket = await sut.verifySetupToken(setupToken!);
    const secondTicket = await sut.verifySetupToken(setupToken!);
    const attempts = await Promise.allSettled([
      sut.setup(
        `admin-${crypto.randomUUID()}@example.com`,
        'Medium',
        'Admin',
        'a sufficiently long password',
        ticket.token,
      ),
      sut.setup(
        `second-admin-${crypto.randomUUID()}@example.com`,
        'Second',
        'Admin',
        'a sufficiently long password',
        secondTicket.token,
      ),
    ]);
    const successes = attempts.filter((attempt) => attempt.status === 'fulfilled');

    expect(successes).toHaveLength(1);
    expect(successes[0]).toMatchObject({ value: { setup: true, user: { role: 'admin' } } });
    await expect(sut.setupStatus()).resolves.toEqual({ setupRequired: false });
  });
});
