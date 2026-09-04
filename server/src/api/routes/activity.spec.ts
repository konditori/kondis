import { describe, expect, it, vi } from 'vitest';

import { createApiApp, createOpenApiDocument } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const ACTIVITY_ID = '00000000-0000-4000-8000-000000000002';

describe('API activity routes', () => {
  it('serves public activity types without an account lookup', async () => {
    const findById = vi.fn(newApiUsers().findById);
    const response = await createApiApp(newApiDependencies({ users: { ...newApiUsers(), findById } })).request(
      '/activities/types',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'run' })]));
    expect(findById).not.toHaveBeenCalled();
  });

  it('requires authentication for activity tags', async () => {
    const response = await createApiApp(newApiDependencies()).request('/activities/tags');

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
    const app = createApiApp(
      newApiDependencies({
        activities: { getById, listBestEfforts, listMatchedRoutes, listRecent },
        users: newApiUsers(),
      }),
    );
    const request = (path: string) => app.request(path, { headers: apiAuthHeaders() });

    const recentResponse = await request('/activities?limit=12&tagMatch=all');
    expect(recentResponse.status).toBe(200);
    expect(listRecent).toHaveBeenCalledWith({ limit: 12, tagMatch: 'all' }, TEST_API_USER.id);

    const bestEffortsResponse = await request('/activities/best-efforts/run/5k');
    expect(bestEffortsResponse.status).toBe(200);
    expect(listBestEfforts).toHaveBeenCalledWith('run', '5k', TEST_API_USER.id);

    const activityResponse = await request(`/activities/${ACTIVITY_ID}`);
    expect(activityResponse.status).toBe(404);
    expect(await activityResponse.json()).toMatchObject({ message: `Activity ${ACTIVITY_ID} does not exist` });
    expect(getById).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id);

    const matchesResponse = await request(`/activities/${ACTIVITY_ID}/matched-routes`);
    expect(matchesResponse.status).toBe(200);
    expect(listMatchedRoutes).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id);
  });

  it('rejects invalid activity ids before calling the service', async () => {
    const getById = vi.fn();
    const app = createApiApp(newApiDependencies({ activities: { getById }, users: newApiUsers() }));
    const response = await app.request('/activities/not-a-uuid', { headers: apiAuthHeaders() });

    expect(response.status).toBe(400);
    expect(getById).not.toHaveBeenCalled();
  });

  it('validates and delegates activity updates and deletes', async () => {
    const updatedActivity = {
      id: ACTIVITY_ID,
      uploadId: '00000000-0000-4000-8000-000000000003',
      sport: 'run' as const,
      name: 'Evening run',
      description: null,
      excludeFromRankings: false,
      tags: ['race' as const],
      startedAt: '2026-09-04T18:00:00.000Z',
      timezoneOffsetMinutes: null,
      metrics: null,
      createdAt: '2026-09-04T18:00:00.000Z',
      updatedAt: '2026-09-04T19:00:00.000Z',
    };
    const updateById = vi.fn(() => Promise.resolve(updatedActivity));
    const deleteById = vi.fn(() => Promise.resolve(true));
    const app = createApiApp(newApiDependencies({ activities: { deleteById, updateById }, users: newApiUsers() }));
    const headers = { ...apiAuthHeaders(), 'Content-Type': 'application/json' };

    const update = await app.request(`/activities/${ACTIVITY_ID}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ name: 'Evening run', tags: ['race'], startedAt: updatedActivity.startedAt }),
    });
    expect(update.status).toBe(200);
    expect(await update.json()).toEqual(updatedActivity);
    expect(updateById).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id, {
      name: 'Evening run',
      tags: ['race'],
      startedAt: new Date(updatedActivity.startedAt),
      excludeFromRankings: undefined,
    });

    const deletion = await app.request(`/activities/${ACTIVITY_ID}`, {
      method: 'DELETE',
      headers: apiAuthHeaders(),
    });
    expect(deletion.status).toBe(204);
    expect(deleteById).toHaveBeenCalledWith(ACTIVITY_ID, TEST_API_USER.id);
  });

  it('returns 404 for activity mutations that do not find the activity', async () => {
    const updateById = vi.fn(() => Promise.resolve(void 0));
    const deleteById = vi.fn(() => Promise.resolve(false));
    const app = createApiApp(newApiDependencies({ activities: { deleteById, updateById }, users: newApiUsers() }));

    const update = await app.request(`/activities/${ACTIVITY_ID}`, {
      method: 'PUT',
      headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Missing activity' }),
    });
    const deletion = await app.request(`/activities/${ACTIVITY_ID}`, {
      method: 'DELETE',
      headers: apiAuthHeaders(),
    });

    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
  });

  it('rejects invalid activity mutation inputs before calling the service', async () => {
    const updateById = vi.fn();
    const deleteById = vi.fn();
    const app = createApiApp(newApiDependencies({ activities: { deleteById, updateById }, users: newApiUsers() }));

    const update = await app.request(`/activities/${ACTIVITY_ID}`, {
      method: 'PUT',
      headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const deletion = await app.request('/activities/not-a-uuid', {
      method: 'DELETE',
      headers: apiAuthHeaders(),
    });

    expect(update.status).toBe(400);
    expect(deletion.status).toBe(400);
    expect(updateById).not.toHaveBeenCalled();
    expect(deleteById).not.toHaveBeenCalled();
  });

  it('preserves activity mutation operation ids and schema references', () => {
    const document = createOpenApiDocument(createApiApp(newApiDependencies()));

    expect(document.paths['/activities/{id}']?.put).toMatchObject({
      operationId: 'ActivityController_updateById',
      requestBody: {
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityUpdateDto' } } },
      },
      responses: {
        200: {
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ActivityDto_Output' } } },
        },
      },
      summary: 'Update one activity',
      tags: ['activities'],
    });
    expect(document.paths['/activities/{id}']?.delete).toMatchObject({
      operationId: 'ActivityController_deleteById',
      responses: { 204: { description: '' } },
      summary: 'Delete one activity',
      tags: ['activities'],
    });
  });
});
