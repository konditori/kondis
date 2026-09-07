import { describe, expect, it, vi } from 'vitest';

import { createApiApp } from 'src/api/app';
import { apiAuthHeaders, newApiDependencies, newApiUsers, TEST_API_USER } from 'test/api';

const importId = '00000000-0000-4000-8000-000000000002';
const status = {
  importId,
  status: 'uploading' as const,
  total: 1,
  uploaded: 0,
  processed: 0,
  failed: 0,
  duplicates: 0,
  error: null,
};

describe('API browser takeout import routes', () => {
  it('checkpoints a manifest and accepts one extracted activity', async () => {
    const activityFile = { originalname: 'run.gpx', size: 9, path: '/tmp/activity' };
    const read = vi.fn(() => Promise.resolve({
      file: activityFile,
      metadata: JSON.stringify({
        itemKey: 'activity:activities/run.gpx',
        originalName: 'run.gpx',
        name: 'Morning run 💨',
        description: '走る',
        tags: [],
      }),
    }));
    const createTakeoutImport = vi.fn(() => Promise.resolve({ importId, status: 'scanning' as const }));
    const scanTakeoutImport = vi.fn(() => Promise.resolve(['activity:activities/run.gpx']));
    const submitTakeoutActivity = vi.fn(() => Promise.resolve(true));
    const app = createApiApp(
      newApiDependencies({
        uploads: { read },
        uploadService: { createTakeoutImport, scanTakeoutImport, submitTakeoutActivity },
        users: newApiUsers(),
      }),
    );

    const created = await app.request('/upload/strava/imports', { method: 'POST', headers: apiAuthHeaders() });
    expect(created.status).toBe(201);
    expect(createTakeoutImport).toHaveBeenCalledWith(TEST_API_USER.id);

    const scan = await app.request(`/upload/strava/imports/${importId}/scan`, {
      method: 'POST',
      headers: { ...apiAuthHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            itemKey: 'activity:activities/run.gpx',
            kind: 'activity',
            originalName: 'run.gpx',
            name: 'Morning run',
            description: null,
            tags: [],
          },
        ],
      }),
    });
    expect(scan.status).toBe(200);
    expect(await scan.json()).toEqual({ pendingItemKeys: ['activity:activities/run.gpx'] });

    const body = new FormData();
    body.append('metadata', JSON.stringify({
      itemKey: 'activity:activities/run.gpx',
      originalName: 'run.gpx',
      name: 'Morning run 💨',
      description: '走る',
      tags: [],
    }));
    body.append('file', new File(['activity'], 'run.gpx'));
    const uploaded = await app.request(`/upload/strava/imports/${importId}/activities`, {
      method: 'POST',
      headers: apiAuthHeaders(),
      body,
    });
    expect(uploaded.status).toBe(202);
    expect(read).toHaveBeenLastCalledWith(expect.any(Request), undefined, 'takeoutActivity');
    expect(submitTakeoutActivity).toHaveBeenCalledWith(
      importId,
      TEST_API_USER.id,
      expect.objectContaining({ itemKey: 'activity:activities/run.gpx', originalName: 'run.gpx', name: 'Morning run 💨', description: '走る' }),
      activityFile,
    );
  });

  it('reports processing progress through the new status route', async () => {
    const getTakeoutImportStatus = vi.fn(() => Promise.resolve(status));
    const app = createApiApp(newApiDependencies({ uploadService: { getTakeoutImportStatus }, users: newApiUsers() }));

    const response = await app.request(`/upload/strava/imports/${importId}`, { headers: apiAuthHeaders() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(status);
    expect(getTakeoutImportStatus).toHaveBeenCalledWith(importId, TEST_API_USER.id);
  });
});
