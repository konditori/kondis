import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createApiAuthMiddleware, type ApiEnv, type ApiSessionLookup } from 'src/api/auth';
import { UserRole } from 'src/enum';

const TOKEN_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  role: UserRole.Admin,
  firstName: 'Current',
  lastName: 'Name',
};
const TOKEN = 'a'.repeat(64);

const createProtectedApp = (sessions: ApiSessionLookup, demoUser?: typeof TOKEN_USER) => {
  const app = new Hono<ApiEnv>();
  app.use(
    '*',
    createApiAuthMiddleware(sessions, () => false, demoUser),
  );
  app.get('/protected', (context) => context.json(context.get('user')));
  return app;
};

describe(createApiAuthMiddleware.name, () => {
  it('preserves the existing missing-token response', async () => {
    const findSession = vi.fn(() => Promise.resolve(undefined));
    const response = await createProtectedApp({ findSession }).request('/protected');

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      message: 'Sign in is required',
      error: 'Unauthorized',
      statusCode: 401,
    });
    expect(findSession).not.toHaveBeenCalled();
  });

  it('uses the account from a valid database session', async () => {
    const findSession = vi.fn(() => Promise.resolve({ id: 'session-id', user: TOKEN_USER }));
    const response = await createProtectedApp({ findSession }).request('/protected', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(TOKEN_USER);
    expect(findSession).toHaveBeenCalledWith(TOKEN);
  });

  it('rejects an unknown or expired session', async () => {
    const response = await createProtectedApp({ findSession: () => Promise.resolve(undefined) }).request('/protected', {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ message: 'Invalid or expired access token' });
  });

  it('uses the configured demo user without accepting a browser credential', async () => {
    const findSession = vi.fn(() => Promise.resolve(undefined));
    const response = await createProtectedApp({ findSession }, TOKEN_USER).request('/protected');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(TOKEN_USER);
    expect(findSession).not.toHaveBeenCalled();
  });
});
