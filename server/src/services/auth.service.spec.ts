import { BadRequestException, ConflictException, ForbiddenException, Logger, UnauthorizedException } from '@nestjs/common';
import { hash } from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConfigService } from 'src/config/config.service';
import type { UserRepository } from 'src/repositories/user.repository';
import { AuthService } from 'src/services/auth.service';
import { newTestService } from 'test/utils';

describe(AuthService.name, () => {
  const findByEmail = vi.fn();
  const count = vi.fn();
  const create = vi.fn();
  const createInitialAdmin = vi.fn();

  const users = { findByEmail, count, create, createInitialAdmin } as unknown as UserRepository;
  const config = {
    authSecret: 'unit-test-secret',
    setupToken: 'unit-test-setup-token',
    registrationEnabled: false,
  } as ConfigService;
  const setup = () => newTestService(AuthService, [users, config], { users, config });

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

  it('requires the setup token and delegates the first-admin race to one atomic repository operation', async () => {
    const { sut } = setup();

    await expect(
      sut.setup('admin@example.com', 'Admin', 'Test', 'long enough password', 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(createInitialAdmin).not.toHaveBeenCalled();
    await expect(
      sut.setup('admin@example.com', 'Admin', 'Test', 'long enough password', 'unit-test-setup-token'),
    ).resolves.toMatchObject({ setup: true, user: { role: 'admin' } });
    expect(createInitialAdmin).toHaveBeenCalledOnce();

    createInitialAdmin.mockResolvedValueOnce(undefined);
    await expect(
      sut.setup('admin@example.com', 'Admin', 'Test', 'long enough password', 'unit-test-setup-token'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs the setup token only while the installation has no administrator', async () => {
    const { sut } = setup();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await sut.logSetupTokenIfRequired();
    expect(warn).toHaveBeenCalledWith('No administrator account exists. Use setup token: unit-test-setup-token');

    count.mockResolvedValue({ count: 1 });
    await sut.logSetupTokenIfRequired();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('disables public registration by default', async () => {
    const { sut } = setup();

    await expect(sut.register('user@example.com', 'User', 'Test', 'long enough password')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
