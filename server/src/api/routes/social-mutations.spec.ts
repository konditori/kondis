import { describe, expect, it, vi } from 'vitest';

import { createApiApp } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const TARGET_ID = '00000000-0000-4000-8000-000000000002';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000003';
const COMMENT_ID = '00000000-0000-4000-8000-000000000004';

describe('API social mutation routes', () => {
  it('delegates relationship, engagement, notification, and comment mutations', async () => {
    const relation = {
      following: false,
      incomingRequest: false,
      outgoingRequest: true,
      blockedByViewer: false,
      blockedViewer: false,
    };
    const comment = {
      id: COMMENT_ID,
      body: 'Nice run',
      createdAt: '2026-09-04T08:00:00.000Z',
      updatedAt: '2026-09-04T08:00:00.000Z',
      user: { id: TEST_API_USER.id, firstName: 'Test', lastName: 'User', avatarUrl: null },
    };
    const service = {
      sendRequest: vi.fn(() => Promise.resolve(relation)),
      cancelRequest: vi.fn(() => Promise.resolve()),
      unfollow: vi.fn(() => Promise.resolve()),
      block: vi.fn(() => Promise.resolve({ blocked: true })),
      unblock: vi.fn(() => Promise.resolve()),
      acceptRequest: vi.fn(() => Promise.resolve({ accepted: true })),
      ignoreRequest: vi.fn(() => Promise.resolve()),
      like: vi.fn((_activityId: string, _userId: string, liked: boolean) =>
        Promise.resolve({ liked, likeCount: liked ? 1 : 0 }),
      ),
      markNotificationsRead: vi.fn(() => Promise.resolve({ markedRead: true })),
      addComment: vi.fn(() => Promise.resolve(comment)),
      updateComment: vi.fn(() => Promise.resolve({ ...comment, body: 'Updated' })),
      deleteComment: vi.fn(() => Promise.resolve()),
    };
    const app = createApiApp(newApiDependencies({ social: service, users: newApiUsers() }));
    const request = (path: string, method: string, body?: object) =>
      app.request(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { ...apiAuthHeaders(), ...(body && { 'Content-Type': 'application/json' }) },
      });

    await expect(request(`/people/${TARGET_ID}/follow-request`, 'POST')).resolves.toMatchObject({ status: 201 });
    await expect(request(`/people/${TARGET_ID}/follow-request`, 'DELETE')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/people/${TARGET_ID}/follow`, 'DELETE')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/people/${TARGET_ID}/block`, 'PUT')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/people/${TARGET_ID}/block`, 'DELETE')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/follow-requests/${TARGET_ID}/accept`, 'POST')).resolves.toMatchObject({ status: 201 });
    await expect(request(`/follow-requests/${TARGET_ID}`, 'DELETE')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/activities/${ACTIVITY_ID}/like`, 'PUT')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/activities/${ACTIVITY_ID}/like`, 'DELETE')).resolves.toMatchObject({ status: 200 });
    await expect(request('/notifications/read', 'PATCH')).resolves.toMatchObject({ status: 200 });
    await expect(request(`/activities/${ACTIVITY_ID}/comments`, 'POST', { body: 'Nice run' })).resolves.toMatchObject({
      status: 201,
    });
    await expect(
      request(`/activities/${ACTIVITY_ID}/comments/${COMMENT_ID}`, 'PATCH', { body: 'Updated' }),
    ).resolves.toMatchObject({ status: 200 });
    await expect(request(`/activities/${ACTIVITY_ID}/comments/${COMMENT_ID}`, 'DELETE')).resolves.toMatchObject({
      status: 200,
    });

    expect(service.sendRequest).toHaveBeenCalledWith(TEST_API_USER.id, TARGET_ID);
    expect(service.like).toHaveBeenNthCalledWith(1, ACTIVITY_ID, TEST_API_USER.id, true);
    expect(service.like).toHaveBeenNthCalledWith(2, ACTIVITY_ID, TEST_API_USER.id, false);
    expect(service.addComment).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id, 'Nice run');
    expect(service.updateComment).toHaveBeenCalledWith(ACTIVITY_ID, COMMENT_ID, TEST_API_USER.id, 'Updated');
  });
});
