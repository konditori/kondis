import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createApiAuthMiddleware, type ApiEnv, type ApiUserLookup } from 'src/api/auth';
import { AUTH_SECRET, createAccessToken } from 'src/auth';

const TOKEN_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  role: 'admin' as const,
  firstName: 'Old',
  lastName: 'Name',
};

const findNoUser = (_id: string) => Promise.resolve(undefined);

const createProtectedApp = (users: ApiUserLookup) => {
  const app = new Hono<ApiEnv>();
  app.use(
    '*',
    createApiAuthMiddleware(users, () => false),
  );
  app.get('/protected', (context) => context.json(context.get('user')));
  return app;
};

describe(createApiAuthMiddleware.name, () => {
  it('preserves the existing unauthorized response', async () => {
    const findById = vi.fn(findNoUser);
    const response = await createProtectedApp({ findById }).request('/protected');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: 'Sign in is required',
      error: 'Unauthorized',
      statusCode: 401,
    });
    expect(findById).not.toHaveBeenCalled();
  });

  it('uses current account data after validating the existing access token', async () => {
    const findById = vi.fn((_id: string) =>
      Promise.resolve({
        id: TOKEN_USER.id,
        email: TOKEN_USER.email,
        role: 'user',
        first_name: 'Current',
        last_name: 'Name',
      } as const),
    );
    const token = createAccessToken(TOKEN_USER, AUTH_SECRET);
    const response = await createProtectedApp({ findById }).request('/protected', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: TOKEN_USER.id,
      email: TOKEN_USER.email,
      role: 'user',
      firstName: 'Current',
      lastName: 'Name',
    });
    expect(findById).toHaveBeenCalledWith(TOKEN_USER.id);
  });
});
