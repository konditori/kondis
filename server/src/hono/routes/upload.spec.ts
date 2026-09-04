import { describe, expect, it, vi } from 'vitest';

import { createHonoApp } from 'src/hono/app';
import { honoAuthHeaders, newHonoDependencies, newHonoUsers, TEST_HONO_USER } from 'test/hono';

describe('Hono upload routes', () => {
  it('delegates disk-backed activity/takeout uploads and progress reads', async () => {
    const activityFile = { originalname: 'run.fit', size: 9, path: '/tmp/activity' };
    const takeoutFile = { originalname: 'export.zip', size: 20, path: '/tmp/takeout' };
    const read = vi.fn((_request: Request, _platform: object | undefined, kind: string) =>
      Promise.resolve(kind === 'activity' ? activityFile : takeoutFile),
    );
    const uploadActivity = vi.fn(() => Promise.resolve({ byteSize: 9, queued: true as const }));
    const uploadLagomTakeout = vi.fn(() =>
      Promise.resolve({
        byteSize: 20,
        queued: true as const,
        importId: '00000000-0000-4000-8000-000000000002',
      }),
    );
    const getLagomTakeoutStatus = vi.fn(() =>
      Promise.resolve({
        importId: '00000000-0000-4000-8000-000000000002',
        status: 'queued' as const,
        total: null,
        processed: 0,
        failed: 0,
        duplicates: 0,
        error: null,
      }),
    );
    const app = createHonoApp(
      newHonoDependencies({
        uploads: { read },
        uploadService: { getLagomTakeoutStatus, uploadActivity, uploadLagomTakeout },
        users: newHonoUsers(),
      }),
    );

    const activity = await app.request('/upload/activity', { method: 'POST', headers: honoAuthHeaders() });
    expect(activity.status).toBe(201);
    expect(uploadActivity).toHaveBeenCalledWith(activityFile, TEST_HONO_USER.id);

    const takeout = await app.request('/upload/strava', { method: 'POST', headers: honoAuthHeaders() });
    expect(takeout.status).toBe(201);
    expect(uploadLagomTakeout).toHaveBeenCalledWith(takeoutFile, TEST_HONO_USER.id);

    const status = await app.request('/upload/strava/00000000-0000-4000-8000-000000000002', {
      headers: honoAuthHeaders(),
    });
    expect(status.status).toBe(200);
    expect(getLagomTakeoutStatus).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002', TEST_HONO_USER.id);
  });

  it('treats invalid service output as an internal error rather than request validation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await createHonoApp(
      newHonoDependencies({
        uploads: { read: () => Promise.resolve({ originalname: 'run.fit', size: 1, path: '/tmp/run.fit' }) },
        uploadService: { uploadActivity: () => Promise.resolve({ byteSize: -1, queued: true }) as never },
        users: newHonoUsers(),
      }),
    ).request('/upload/activity', { method: 'POST', headers: honoAuthHeaders() });

    expect(response.status).toBe(500);
    consoleError.mockRestore();
  });
});
