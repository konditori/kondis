import { describe, expect, it, vi } from 'vitest';

import { createHonoApp } from 'src/hono/app';
import { honoAuthHeaders, newHonoDependencies, newHonoUsers, TEST_HONO_USER } from 'test/hono';

const ACTIVITY_ID = '00000000-0000-4000-8000-000000000002';

describe('Hono activity read routes', () => {
  it('serves public activity types without an account lookup', async () => {
    const findById = vi.fn(newHonoUsers().findById);
    const response = await createHonoApp(newHonoDependencies({ users: { ...newHonoUsers(), findById } })).request(
      '/activities/types',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'run' })]));
    expect(findById).not.toHaveBeenCalled();
  });

  it('requires authentication for activity tags', async () => {
    const response = await createHonoApp(newHonoDependencies()).request('/activities/tags');

    expect(response.status).toBe(401);
  });

  it('validates inputs and delegates authenticated reads to the activity service', async () => {
    const listRecent = vi.fn(() => Promise.resolve({ activities: [], nextCursor: null, total: 0 }));
    const listBestEfforts = vi.fn(() =>
      Promise.resolve({
        sport: 'run' as const,
        type: '5k' as const,
        valueKind: 'duration' as const,
        higherIsBetter: false,
        distance: 5000 as const,
        duration: null,
        options: [],
        efforts: [],
      }),
    );
    const getById = vi.fn(() => Promise.resolve(void 0));
    const listMatchedRoutes = vi.fn(() => Promise.resolve({ sourceActivityId: ACTIVITY_ID, activities: null }));
    const app = createHonoApp(
      newHonoDependencies({
        activities: { getById, listBestEfforts, listMatchedRoutes, listRecent },
        users: newHonoUsers(),
      }),
    );
    const request = (path: string) => app.request(path, { headers: honoAuthHeaders() });

    const recentResponse = await request('/activities?limit=12&tagMatch=all');
    expect(recentResponse.status).toBe(200);
    expect(listRecent).toHaveBeenCalledWith({ limit: 12, tagMatch: 'all' }, TEST_HONO_USER.id);

    const bestEffortsResponse = await request('/activities/best-efforts/run/5k');
    expect(bestEffortsResponse.status).toBe(200);
    expect(listBestEfforts).toHaveBeenCalledWith('run', '5k', TEST_HONO_USER.id);

    const activityResponse = await request(`/activities/${ACTIVITY_ID}`);
    expect(activityResponse.status).toBe(404);
    expect(await activityResponse.json()).toMatchObject({ message: `Activity ${ACTIVITY_ID} does not exist` });
    expect(getById).toHaveBeenCalledWith(ACTIVITY_ID, TEST_HONO_USER.id);

    const matchesResponse = await request(`/activities/${ACTIVITY_ID}/matched-routes`);
    expect(matchesResponse.status).toBe(200);
    expect(listMatchedRoutes).toHaveBeenCalledWith(ACTIVITY_ID, TEST_HONO_USER.id);
  });

  it('rejects invalid activity ids before calling the service', async () => {
    const getById = vi.fn();
    const app = createHonoApp(newHonoDependencies({ activities: { getById }, users: newHonoUsers() }));
    const response = await app.request('/activities/not-a-uuid', { headers: honoAuthHeaders() });

    expect(response.status).toBe(400);
    expect(getById).not.toHaveBeenCalled();
  });
});
