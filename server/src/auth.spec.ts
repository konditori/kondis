import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ADMIN,
  AUTH_SECRET,
  AuthGuard,
  createAccessToken,
  createActivityEventsTicket,
  verifyActivityEventsTicket,
} from 'src/auth';
import { type UserRepository } from 'src/repositories/user.repository';

const TOKEN_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  role: 'admin' as const,
  firstName: 'Old',
  lastName: 'Name',
};
const SECRET = 'test-secret';

describe('activity event tickets', () => {
  afterEach(() => vi.useRealTimers());

  it('accepts a current ticket and returns only its authenticated user id', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));

    const ticket = createActivityEventsTicket('8300a315-5101-4bbf-8813-6244965ed9b5', SECRET);

    expect(verifyActivityEventsTicket(ticket.token, SECRET)).toBe('8300a315-5101-4bbf-8813-6244965ed9b5');
  });

  it('rejects expired, altered, and normal access tokens', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-17T12:00:00Z'));
    const ticket = createActivityEventsTicket('8300a315-5101-4bbf-8813-6244965ed9b5', SECRET);
    const accessToken = createAccessToken(
      {
        id: '8300a315-5101-4bbf-8813-6244965ed9b5',
        role: 'user',
        email: 'a@example.com',
        firstName: 'A',
        lastName: 'User',
      },
      SECRET,
    );

    expect(verifyActivityEventsTicket(`${ticket.token}x`, SECRET)).toBeUndefined();
    expect(verifyActivityEventsTicket(accessToken, SECRET)).toBeUndefined();
    vi.advanceTimersByTime(60_001);
    expect(verifyActivityEventsTicket(ticket.token, SECRET)).toBeUndefined();
  });
});

const contextFor = (token: string, adminOnly = false) => {
  const handler = {};
  if (adminOnly) {
    // reflect-metadata augments the standard Reflect object at runtime.
    // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties
    Reflect.defineMetadata(ADMIN, true, handler);
  }
  const request = { headers: { authorization: `Bearer ${token}` } };
  const context = {
    getHandler: () => handler,
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
};

describe(AuthGuard.name, () => {
  it('rejects an otherwise valid token after its account is deleted', async () => {
    const users = { findById: vi.fn().mockResolvedValue(undefined) } as unknown as UserRepository;
    const guard = new AuthGuard(users);
    const { context } = contextFor(createAccessToken(TOKEN_USER, AUTH_SECRET));

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses the stored role so demotion immediately removes administrator access', async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({
        id: TOKEN_USER.id,
        email: TOKEN_USER.email,
        role: 'user',
        first_name: 'Current',
        last_name: 'Name',
      }),
    } as unknown as UserRepository;
    const guard = new AuthGuard(users);
    const { context } = contextFor(createAccessToken(TOKEN_USER, AUTH_SECRET), true);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts the HttpOnly session cookie for same-origin browser requests', async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({
        id: TOKEN_USER.id,
        email: TOKEN_USER.email,
        role: 'admin',
        first_name: 'Current',
        last_name: 'Name',
      }),
    } as unknown as UserRepository;
    const guard = new AuthGuard(users);
    const token = createAccessToken(TOKEN_USER, AUTH_SECRET);
    const { context } = contextFor(token);
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    delete request.headers.authorization;
    request.headers.cookie = `other=value; kondis_session=${token}`;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('prefers the dedicated Kondis header over a perimeter Authorization bearer token', async () => {
    const users = {
      findById: vi.fn().mockResolvedValue({
        id: TOKEN_USER.id,
        email: TOKEN_USER.email,
        role: 'admin',
        first_name: 'Current',
        last_name: 'Name',
      }),
    } as unknown as UserRepository;
    const guard = new AuthGuard(users);
    const kondisToken = createAccessToken(TOKEN_USER, AUTH_SECRET);
    const { context, request } = contextFor(kondisToken);
    request.headers.authorization = 'Bearer opaque-perimeter-access-token';
    (request.headers as Record<string, string>)['x-kondis-authorization'] = `Bearer ${kondisToken}`;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(users.findById).toHaveBeenCalledWith(TOKEN_USER.id);
  });

  it('rejects an invalid perimeter Authorization token when no Kondis header is present', async () => {
    const users = { findById: vi.fn() } as unknown as UserRepository;
    const guard = new AuthGuard(users);
    const { context, request } = contextFor('not-a-real-token');
    request.headers.authorization = 'Bearer opaque-perimeter-access-token';

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findById).not.toHaveBeenCalled();
  });
});
