import { hash } from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from 'src/errors';
import { Logger } from 'src/logger';
import type { ConfigRepository } from 'src/repositories/config.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import type { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { newTestService } from 'test/utils';

const setupToken = (sut: AuthService): string => (sut as unknown as { setupToken: string }).setupToken;

describe(AuthService.name, () => {
  const findByEmail = vi.fn();
  const count = vi.fn();
  const create = vi.fn();
  const createInitialAdmin = vi.fn();

  const users = { findByEmail, count, create, createInitialAdmin } as unknown as UserRepository;
  const config = {
    registrationEnabled: false,
  } as ConfigRepository;
  const setup = () =>
    newTestService(AuthService, [users, config, new RateLimitingRepository(), new CryptoRepository()], {
      users,
      config,
    });
  beforeEach(() => {
    vi.clearAllMocks();
    count.mockResolvedValue({ count: 0 });
    findByEmail.mockResolvedValue(undefined);
    create.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      first_name: 'User',
      last_name: 'Test',
      role: 'user',
      password_hash: 'hash',
    });
    createInitialAdmin.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.com',
      first_name: 'Admin',
      last_name: 'Test',
      role: 'admin',
      password_hash: 'hash',
    });
  });

  it('creates normalized user name parts', async () => {
    const { sut } = setup();

    const user = await sut.create('USER@example.com', '  User  ', ' Test ', 'long enough password', 'user');

    expect(user).toMatchObject({ email: 'user@example.com', first_name: 'User', last_name: 'Test' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', first_name: 'User', last_name: 'Test' }),
    );
  });

  it('rejects invalid account data and duplicate emails', async () => {
    const { sut } = setup();

    await expect(sut.create('invalid', 'User', 'Test', 'long enough password', 'user')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    findByEmail.mockResolvedValue({ id: 'existing' });
    await expect(sut.create('user@example.com', 'User', 'Test', 'long enough password', 'user')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('logs in with valid credentials and rejects invalid credentials', async () => {
    const { sut } = setup();
    const passwordHash = await hash('long enough password', 4);
    findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      first_name: 'User',
      last_name: 'Test',
      role: 'user',
      password_hash: passwordHash,
    });

    await expect(sut.login('USER@EXAMPLE.COM', 'long enough password')).resolves.toMatchObject({
      user: { id: 'user-1', email: 'user@example.com' },
      setup: false,
      accessToken: expect.any(String),
    });
    await expect(sut.login('user@example.com', 'wrong password')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('verifies the setup token before creating the first administrator', async () => {
    const { sut } = setup();

    await expect(sut.verifySetupToken('wrong-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(createInitialAdmin).not.toHaveBeenCalled();
    const { token } = await sut.verifySetupToken(setupToken(sut));
    await expect(sut.validateSetupTicket(token)).resolves.toEqual({ valid: true });
    await expect(sut.setup('admin@example.com', 'Admin', 'Test', 'long enough password', token)).resolves.toMatchObject(
      { setup: true, user: { role: 'admin' } },
    );
    expect(createInitialAdmin).toHaveBeenCalledOnce();

    createInitialAdmin.mockResolvedValueOnce(undefined);
    const { token: nextToken } = await sut.verifySetupToken(setupToken(sut));
    await expect(
      sut.setup('admin@example.com', 'Admin', 'Test', 'long enough password', nextToken),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs the setup token only while the installation has no administrator', async () => {
    const { sut } = setup();
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    await sut.logSetupTokenIfRequired();
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('Welcome to Kondis!');
    expect(log.mock.calls[0][0]).toContain(setupToken(sut));
    expect(log.mock.calls[0][0]).toContain('go to the app in a web browser');

    count.mockResolvedValue({ count: 1 });
    await sut.logSetupTokenIfRequired();
    expect(log).toHaveBeenCalledOnce();
  });

  it('disables public registration by default', async () => {
    const { sut } = setup();

    await expect(sut.register('user@example.com', 'User', 'Test', 'long enough password')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
