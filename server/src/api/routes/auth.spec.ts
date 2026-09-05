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
    expect(login).toHaveBeenCalledWith('user@example.com', 'long enough password', 'unknown');
    expect(findById).not.toHaveBeenCalled();
  });

  it('ignores client-supplied proxy addresses unless proxy trust is enabled', async () => {
    const verifySetupToken = vi.fn(() =>
      Promise.resolve({ token: 'setup-ticket', expiresAt: '2026-09-04T10:00:00.000Z' }),
    );
    const request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.1',
        'X-Forwarded-For': '198.51.100.2',
      },
      body: JSON.stringify({ setupToken: 'bootstrap-token' }),
    } as const;

    await createApiApp(newApiDependencies({ auth: { verifySetupToken } })).request('/auth/setup/verify', request);
    expect(verifySetupToken).toHaveBeenLastCalledWith('bootstrap-token', 'unknown');

    await createApiApp(newApiDependencies({ auth: { verifySetupToken }, config: { trustProxyHeaders: true } })).request(
      '/auth/setup/verify',
      request,
    );
    expect(verifySetupToken).toHaveBeenLastCalledWith('bootstrap-token', '198.51.100.1');
  });

  it('returns the current stored account and restricts job tickets to admins', async () => {
    const createJobEventsTicket = vi.fn(() =>
      Promise.resolve({
        token: 'a-valid-ticket-token-value',
        expiresAt: '2026-09-04T10:00:00.000Z',
      }),
    );
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

  it('revokes the current session on logout', async () => {
    const revokeSession = vi.fn(() => Promise.resolve());
    const app = createApiApp(newApiDependencies({ auth: { revokeSession } }));

    const response = await app.request('/auth/logout', { method: 'POST', headers: apiAuthHeaders() });

    expect(response.status).toBe(204);
    expect(revokeSession).toHaveBeenCalledWith(`session-${TEST_API_USER.id}`);
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

  it('documents every auth JSON response schema', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));
    const responseSchemas = [
      ['/auth/capabilities', 'get', 200, 'AuthCapabilitiesDto_Output'],
      ['/auth/setup', 'get', 200, 'SetupStatusDto_Output'],
      ['/auth/setup', 'post', 201, 'AuthSessionDto_Output'],
      ['/auth/setup/verify', 'post', 201, 'SetupTicketDto_Output'],
      ['/auth/setup/validate', 'post', 201, 'SetupValidationDto_Output'],
      ['/auth/login', 'post', 201, 'AuthSessionDto_Output'],
      ['/auth/register', 'post', 201, 'AuthSessionDto_Output'],
      ['/auth/me', 'get', 200, 'AuthUserDto_Output'],
    ] as const;

    for (const [path, method, status, schema] of responseSchemas) {
      expect(document.paths[path]?.[method]?.responses?.[status]).toMatchObject({
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
      });
    }
    expect(document.components?.schemas?.AuthUserDto_Output).toMatchObject({
      properties: { avatarUrl: { type: 'string', nullable: true } },
    });
  });
});
