import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const AVATAR_OWNER_ID = '00000000-0000-4000-8000-000000000002';
const ADMIN_USER = { ...TEST_API_USER, role: 'admin' as const };

describe('API user read routes', () => {
  it('keeps the user list restricted to administrators', async () => {
    const all = vi.fn(() => Promise.resolve([]));
    const response = await createApiApp(newApiDependencies({ users: { ...newApiUsers(), all } })).request('/users', {
      headers: apiAuthHeaders(),
    });

    expect(response.status).toBe(403);
    expect(all).not.toHaveBeenCalled();
  });

  it('removes password hashes from the administrator user list', async () => {
    const all = vi.fn(() =>
      Promise.resolve([
        {
          id: TEST_API_USER.id,
          email: TEST_API_USER.email,
          password_hash: 'secret',
          role: 'user',
        },
      ]),
    );
    const response = await createApiApp(newApiDependencies({ users: { ...newApiUsers(ADMIN_USER), all } })).request(
      '/users',
      { headers: apiAuthHeaders(ADMIN_USER) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: TEST_API_USER.id, email: TEST_API_USER.email, role: 'user' }]);
  });

  it('streams avatar bytes with the existing response headers', async () => {
    const lastModified = new Date('2026-08-20T12:00:00Z');
    const avatarFile = vi.fn(() =>
      Promise.resolve({
        id: AVATAR_OWNER_ID,
        avatar_path: 'avatars/profile.webp',
        avatar_mime_type: 'image/webp',
        avatar_size: 600,
      }),
    );
    const avatarAbsolutePath = vi.fn(() => '/data/avatars/profile.webp');
    const close = vi.fn(() => Promise.resolve());
    const stream = vi.fn(() => new Uint8Array(Buffer.from('avatar')));
    const open = vi.fn(() => Promise.resolve({ size: 6, lastModified, close, stream }));
    const app = createApiApp(
      newApiDependencies({
        files: { open },
        userService: { avatarAbsolutePath, avatarFile },
        users: newApiUsers(),
      }),
    );
    const response = await app.request(`/users/${AVATAR_OWNER_ID}/avatar`, { headers: apiAuthHeaders() });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('avatar');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Content-Length')).toBe('6');
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Last-Modified')).toBe(lastModified.toUTCString());
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(avatarFile).toHaveBeenCalledWith(AVATAR_OWNER_ID, TEST_API_USER.id);
    expect(avatarAbsolutePath).toHaveBeenCalledWith('avatars/profile.webp');
    expect(open).toHaveBeenCalledWith('/data/avatars/profile.webp');
    expect(stream).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    expect(close).not.toHaveBeenCalled();

    stream.mockClear();
    open.mockClear();
    avatarAbsolutePath.mockClear();
    const headResponse = await app.request(`/users/${AVATAR_OWNER_ID}/avatar`, {
      method: 'HEAD',
      headers: apiAuthHeaders(),
    });
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('Content-Length')).toBe('6');
    expect(stream).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(avatarAbsolutePath).toHaveBeenCalledWith('avatars/profile.webp');
    expect(open).toHaveBeenCalledWith('/data/avatars/profile.webp');
  });

  it('documents avatar files as full or partial binary responses', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));
    const responses = document.paths['/users/{id}/avatar']?.get?.responses;
    const binaryContent = {
      'image/*': { schema: { type: 'string', format: 'binary' } },
    };

    expect(responses).toEqual({
      200: { description: 'Profile picture', content: binaryContent },
      206: { description: 'Requested profile picture byte range', content: binaryContent },
      304: { description: 'Profile picture was not modified' },
      404: { description: 'Profile picture does not exist' },
      416: { description: 'Requested byte range is not satisfiable' },
    });
  });
});
