import { describe, expect, it, vi } from 'vitest';

import { createApiApp } from 'src/api/app';
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
    const avatarFile = vi.fn(() =>
      Promise.resolve({
        id: AVATAR_OWNER_ID,
        avatar_path: 'avatars/profile.webp',
        avatar_mime_type: 'image/webp',
        avatar_size: 6,
      }),
    );
    const avatarAbsolutePath = vi.fn(() => '/data/avatars/profile.webp');
    const read = vi.fn(() =>
      Promise.resolve(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('avatar'));
            controller.close();
          },
        }),
      ),
    );
    const app = createApiApp(
      newApiDependencies({
        files: { read },
        userService: { avatarAbsolutePath, avatarFile },
        users: newApiUsers(),
      }),
    );
    const response = await app.request(`/users/${AVATAR_OWNER_ID}/avatar`, { headers: apiAuthHeaders() });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('avatar');
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Content-Length')).toBe('6');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(avatarFile).toHaveBeenCalledWith(AVATAR_OWNER_ID, TEST_API_USER.id);
    expect(avatarAbsolutePath).toHaveBeenCalledWith('avatars/profile.webp');
    expect(read).toHaveBeenCalledWith('/data/avatars/profile.webp');

    read.mockClear();
    avatarAbsolutePath.mockClear();
    const headResponse = await app.request(`/users/${AVATAR_OWNER_ID}/avatar`, {
      method: 'HEAD',
      headers: apiAuthHeaders(),
    });
    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get('Content-Length')).toBe('6');
    expect(read).not.toHaveBeenCalled();
    expect(avatarAbsolutePath).not.toHaveBeenCalled();
  });
});
