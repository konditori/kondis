import { describe, expect, it, vi } from 'vitest';

import { createHonoApp } from 'src/hono/app';
import { honoAuthHeaders, newHonoDependencies, newHonoUsers, TEST_HONO_USER } from 'test/hono';

describe('Hono auth routes', () => {
  it('serves public auth routes without looking up a session user', async () => {
    const findById = vi.fn(() => Promise.resolve(undefined));
    const setupStatus = vi.fn(() => Promise.resolve({ setupRequired: true }));
    const login = vi.fn(() =>
      Promise.resolve({
        accessToken: 'token',
        setup: false,
        user: {
          id: TEST_HONO_USER.id,
          email: TEST_HONO_USER.email,
          firstName: TEST_HONO_USER.firstName,
          lastName: TEST_HONO_USER.lastName,
          role: TEST_HONO_USER.role,
          avatarUrl: null,
        },
      }),
    );
    const app = createHonoApp(
      newHonoDependencies({
        auth: { login, setupStatus },
        config: { registrationEnabled: true },
        users: { all: () => Promise.resolve([]), findById },
      }),
    );

    const statusResponse = await app.request('/auth/setup');
    expect(await statusResponse.json()).toEqual({ setupRequired: true, registrationEnabled: true });

    const loginResponse = await app.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'long enough password' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(loginResponse.status).toBe(201);
    expect(login).toHaveBeenCalledWith('user@example.com', 'long enough password');
    expect(findById).not.toHaveBeenCalled();
  });

  it('returns the current stored account and restricts job tickets to admins', async () => {
    const createJobEventsTicket = vi.fn(() => ({
      token: 'a-valid-ticket-token-value',
      expiresAt: '2026-09-04T10:00:00.000Z',
    }));
    const users = newHonoUsers();
    const app = createHonoApp(newHonoDependencies({ auth: { createJobEventsTicket }, users }));

    const meResponse = await app.request('/auth/me', { headers: honoAuthHeaders() });
    expect(await meResponse.json()).toMatchObject({ id: TEST_HONO_USER.id, email: TEST_HONO_USER.email });

    const ticketResponse = await app.request('/auth/job-events-ticket', {
      method: 'POST',
      headers: honoAuthHeaders(),
    });
    expect(ticketResponse.status).toBe(403);
    expect(createJobEventsTicket).not.toHaveBeenCalled();
  });

  it('uses the established validation error shape for manually parsed auth bodies', async () => {
    const app = createHonoApp(newHonoDependencies());
    const response = await app.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ statusCode: 400, message: 'Validation failed' });

    const malformed = await app.request('/auth/login', {
      method: 'POST',
      body: '{',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(malformed.status).toBe(400);

    const oversized = await app.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'x'.repeat(101 * 1024) }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(oversized.status).toBe(413);
  });
});
