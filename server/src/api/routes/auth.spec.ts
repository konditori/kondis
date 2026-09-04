import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

describe('API auth routes', () => {
  it('serves public auth routes without looking up a session user', async () => {
    const findById = vi.fn(() => Promise.resolve(undefined));
    const setupStatus = vi.fn(() => Promise.resolve({ setupRequired: true }));
    const login = vi.fn(() =>
      Promise.resolve({
        accessToken: 'token',
        setup: false,
        user: {
          id: TEST_API_USER.id,
          email: TEST_API_USER.email,
          firstName: TEST_API_USER.firstName,
          lastName: TEST_API_USER.lastName,
          role: TEST_API_USER.role,
          avatarUrl: null,
        },
      }),
    );
    const app = createApiApp(
      newApiDependencies({
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
    const users = newApiUsers();
    const app = createApiApp(newApiDependencies({ auth: { createJobEventsTicket }, users }));

    const meResponse = await app.request('/auth/me', { headers: apiAuthHeaders() });
    expect(await meResponse.json()).toMatchObject({ id: TEST_API_USER.id, email: TEST_API_USER.email });

    const ticketResponse = await app.request('/auth/job-events-ticket', {
      method: 'POST',
      headers: apiAuthHeaders(),
    });
    expect(ticketResponse.status).toBe(403);
    expect(createJobEventsTicket).not.toHaveBeenCalled();
  });

  it('uses the established validation error shape for invalid auth bodies', async () => {
    const app = createApiApp(newApiDependencies());
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

  it('documents every auth request body as required application/json', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));
    const requestSchemas = [
      ['/auth/setup', 'SetupCredentialsDto'],
      ['/auth/setup/verify', 'SetupTokenCredentialsDto'],
      ['/auth/setup/validate', 'SetupTicketCredentialsDto'],
      ['/auth/login', 'CredentialsDto'],
      ['/auth/register', 'RegistrationCredentialsDto'],
    ] as const;

    for (const [path, schema] of requestSchemas) {
      expect(document.paths[path]?.post?.requestBody).toEqual({
        required: true,
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
      });
    }
  });
});
