import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createNodeApiApp } from 'src/api/node';
import { AuthService } from 'src/services/auth.service';
import type { KondisDatabase } from 'src/types';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe('authentication API smoke tests', () => {
  let db: KondisDatabase;
  let testApp: TestApp;
  let api: ReturnType<typeof createNodeApiApp>;
  let auth: AuthService;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();
    api = createNodeApiApp(testApp.app);
    auth = testApp.get(AuthService);
  });

  beforeEach(async () => {
    await resetMediumTestDatabase(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  it('logs in with valid credentials and returns a usable access token', async () => {
    const email = `login-${crypto.randomUUID()}@example.com`;
    const password = 'a sufficiently long password';
    const user = await auth.create(email, 'Medium', 'Test', password, 'user');

    const response = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    expect(response.status).toBe(201);
    const session = await response.json();
    expect(session).toMatchObject({
      setup: false,
      user: { id: user.id, email, firstName: 'Medium', lastName: 'Test', role: 'user' },
      accessToken: expect.any(String),
    });

    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const me = await api.request('/auth/me', { headers });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ id: user.id, email });

    const logout = await api.request('/auth/logout', { method: 'POST', headers });
    const revoked = await api.request('/auth/me', { headers });
    expect(logout.status).toBe(204);
    expect(revoked.status).toBe(401);
  });

  it('rejects invalid login credentials without issuing a session', async () => {
    const email = `login-${crypto.randomUUID()}@example.com`;
    await auth.create(email, 'Medium', 'Test', 'a sufficiently long password', 'user');

    const response = await api.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrong password' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
  });
});
