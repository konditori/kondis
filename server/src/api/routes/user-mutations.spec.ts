import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

describe('API user mutation routes', () => {
  it('updates the signed-in user and handles avatar mutations through the upload adapter', async () => {
    const file = { originalname: 'avatar.png', size: 6, buffer: Buffer.from('avatar') };
    const read = vi.fn(() => Promise.resolve(file));
    const updateProfile = vi.fn(() =>
      Promise.resolve({
        id: TEST_API_USER.id,
        email: TEST_API_USER.email,
        firstName: 'Updated',
        lastName: 'Name',
        role: 'user' as const,
        avatarUrl: null,
      }),
    );
    const uploadAvatar = vi.fn(() => Promise.resolve({ avatarUrl: '/api/v1/users/me/avatar' }));
    const clearAvatar = vi.fn(() => Promise.resolve());
    const app = createApiApp(
      newApiDependencies({
        uploads: { read },
        userService: { clearAvatar, updateProfile, uploadAvatar },
        users: newApiUsers(),
      }),
    );

    const update = await app.request('/users/me', {
      method: 'PATCH',
      headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: ' Updated ', lastName: ' Name ' }),
    });
    expect(update.status).toBe(200);
    expect(updateProfile).toHaveBeenCalledWith(TEST_API_USER.id, 'Updated', 'Name');

    const upload = await app.request('/users/me/avatar', { method: 'POST', headers: apiAuthHeaders() });
    expect(upload.status).toBe(201);
    expect(read).toHaveBeenCalledWith(expect.any(Request), undefined, 'avatar');
    expect(uploadAvatar).toHaveBeenCalledWith(TEST_API_USER.id, file);

    const deletion = await app.request('/users/me/avatar', { method: 'DELETE', headers: apiAuthHeaders() });
    expect(deletion.status).toBe(204);
    expect(clearAvatar).toHaveBeenCalledWith(TEST_API_USER.id);
  });

  it('keeps user creation restricted to administrators', async () => {
    const create = vi.fn();
    const response = await createApiApp(newApiDependencies({ auth: { create }, users: newApiUsers() })).request(
      '/users',
      {
        method: 'POST',
        headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          password: 'long enough password',
        }),
      },
    );

    expect(response.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('documents user mutation bodies as required application/json', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));

    expect(document.paths['/users']?.post?.requestBody).toEqual({
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/UserCreateDto' } } },
    });
    expect(document.paths['/users/me']?.patch?.requestBody).toEqual({
      required: true,
      content: { 'application/json': { schema: { $ref: '#/components/schemas/UserUpdateDto' } } },
    });
  });
});
