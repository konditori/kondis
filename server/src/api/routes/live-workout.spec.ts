import { describe, expect, it, vi } from 'vitest';

import { createApiApp } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const WORKOUT_ID = '00000000-0000-4000-8000-000000000002';
const workout = {
  id: WORKOUT_ID,
  sport: 'run' as const,
  startedAt: '2026-09-04T08:00:00.000Z',
  status: 'recording' as const,
  canShare: true,
  elapsedSeconds: 10,
  distanceMeters: 20,
  lastSequence: 1,
  lastPointAt: null,
  lastReceivedAt: null,
  route: [],
};

describe('API live workout routes', () => {
  it('keeps shared lookups public and delegates owner routes', async () => {
    const service = {
      list: vi.fn(() => Promise.resolve([workout])),
      create: vi.fn(() => Promise.resolve(workout)),
      getShared: vi.fn(() => Promise.resolve({ ...workout, canShare: false })),
      get: vi.fn(() => Promise.resolve(workout)),
      appendPoints: vi.fn(() => Promise.resolve({ id: WORKOUT_ID, lastSequence: 2 })),
      updateState: vi.fn(() => Promise.resolve({ ...workout, status: 'paused' as const })),
      createShare: vi.fn(() =>
        Promise.resolve({ token: 'a-public-share-token-value', expiresAt: '2026-09-05T08:00:00.000Z' }),
      ),
      revokeShare: vi.fn(() => Promise.resolve()),
      discard: vi.fn(() => Promise.resolve()),
    };
    const app = createApiApp(newApiDependencies({ liveWorkouts: service, users: newApiUsers() }));

    const shared = await app.request('/live-workouts/shared/share-token');
    expect(shared.status).toBe(200);
    expect(service.getShared).toHaveBeenCalledWith('share-token');

    const list = await app.request('/live-workouts', { headers: apiAuthHeaders() });
    expect(list.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(TEST_API_USER.id);

    const created = await app.request('/live-workouts', {
      method: 'POST',
      headers: { ...apiAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSessionId: '00000000-0000-4000-8000-000000000003',
        sport: 'run',
        startedAt: '2026-09-04T08:00:00.000Z',
      }),
    });
    expect(created.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(TEST_API_USER.id, expect.objectContaining({ sport: 'run' }));

    const discarded = await app.request(`/live-workouts/${WORKOUT_ID}`, {
      method: 'DELETE',
      headers: apiAuthHeaders(),
    });
    expect(discarded.status).toBe(204);
    expect(service.discard).toHaveBeenCalledWith(WORKOUT_ID, TEST_API_USER.id);
  });
});
