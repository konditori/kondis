import { describe, expect, it, vi } from 'vitest';

import { createApiApp } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const PERSON_ID = '00000000-0000-4000-8000-000000000002';
const ACTIVITY_ID = '00000000-0000-4000-8000-000000000003';
const emptyActivityPage = () => ({ activities: [], nextCursor: null, total: 0 });

describe('API social read routes', () => {
  it('delegates every social read with the authenticated viewer and parsed inputs', async () => {
    const people = vi.fn(() => Promise.resolve([]));
    const person = vi.fn(() =>
      Promise.resolve({
        user: { id: PERSON_ID, firstName: 'Other', lastName: 'User', avatarUrl: null },
        relation: {
          following: false,
          incomingRequest: false,
          outgoingRequest: false,
          blockedByViewer: false,
          blockedViewer: false,
        },
      }),
    );
    const profileActivities = vi.fn(() => Promise.resolve(emptyActivityPage()));
    const requests = vi.fn(() => Promise.resolve([]));
    const feed = vi.fn(() => Promise.resolve(emptyActivityPage()));
    const likers = vi.fn(() => Promise.resolve([]));
    const notifications = vi.fn(() => Promise.resolve({ notifications: [], unreadCount: 0 }));
    const comments = vi.fn(() => Promise.resolve({ comments: [], nextCursor: null }));
    const app = createApiApp(
      newApiDependencies({
        activities: { feed, profileActivities },
        social: { comments, likers, notifications, people, person, requests },
        users: newApiUsers(),
      }),
    );
    const request = (path: string) => app.request(path, { headers: apiAuthHeaders() });

    const peopleResponse = await request('/people?query=runner');
    expect(peopleResponse.status).toBe(200);
    expect(people).toHaveBeenCalledWith(TEST_API_USER.id, 'runner');

    const personResponse = await request(`/people/${PERSON_ID}`);
    expect(personResponse.status).toBe(200);
    expect(person).toHaveBeenCalledWith(TEST_API_USER.id, PERSON_ID);

    const activitiesResponse = await request(`/people/${PERSON_ID}/activities?limit=7`);
    expect(activitiesResponse.status).toBe(200);
    expect(profileActivities).toHaveBeenCalledWith(TEST_API_USER.id, PERSON_ID, {
      limit: 7,
      tagMatch: 'any',
    });

    const requestsResponse = await request('/follow-requests?direction=outgoing');
    expect(requestsResponse.status).toBe(200);
    expect(requests).toHaveBeenCalledWith(TEST_API_USER.id, 'outgoing');

    const feedResponse = await request('/feed');
    expect(feedResponse.status).toBe(200);
    expect(feed).toHaveBeenCalledWith(TEST_API_USER.id, { limit: 50, tagMatch: 'any' });

    const likersResponse = await request(`/activities/${ACTIVITY_ID}/likes`);
    expect(likersResponse.status).toBe(200);
    expect(likers).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id);

    const notificationsResponse = await request('/notifications?limit=5');
    expect(notificationsResponse.status).toBe(200);
    expect(notifications).toHaveBeenCalledWith(TEST_API_USER.id, 5);

    const commentsResponse = await request(`/activities/${ACTIVITY_ID}/comments?cursor=next&limit=6`);
    expect(commentsResponse.status).toBe(200);
    expect(comments).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id, 'next', 6);
  });

  it('preserves omitted limits and rejects malformed or out-of-range limits', async () => {
    const notifications = vi.fn(() => Promise.resolve({ notifications: [], unreadCount: 0 }));
    const comments = vi.fn(() => Promise.resolve({ comments: [], nextCursor: null }));
    const app = createApiApp(
      newApiDependencies({
        social: { comments, notifications },
        users: newApiUsers(),
      }),
    );
    const request = (path: string) => app.request(path, { headers: apiAuthHeaders() });

    expect((await request('/notifications')).status).toBe(200);
    expect(notifications).toHaveBeenCalledWith(TEST_API_USER.id, undefined);
    expect((await request(`/activities/${ACTIVITY_ID}/comments`)).status).toBe(200);
    expect(comments).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id, undefined, undefined);

    for (const limit of ['nope', '0', '-1', '1.5', '51']) {
      expect((await request(`/notifications?limit=${limit}`)).status, limit).toBe(400);
      expect((await request(`/activities/${ACTIVITY_ID}/comments?limit=${limit}`)).status, limit).toBe(400);
    }
    expect(notifications).toHaveBeenCalledTimes(1);
    expect(comments).toHaveBeenCalledTimes(1);
  });
});
