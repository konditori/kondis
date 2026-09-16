import { describe, expect, it } from 'vitest';

import { createApiApp, createApiShell } from 'src/api/app';
import { registerWorkerPortableRouteGroups } from 'src/api/route-groups';
import { buildCapabilities } from 'src/api/routes/capabilities';
import { ACTIVITY_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS, VIDEO_FILE_EXTENSIONS } from 'src/config/upload-formats';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { apiAuthHeaders, newApiDependencies, newApiUsers } from 'test/api';

describe('API capabilities route', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await createApiApp(newApiDependencies({ users: newApiUsers() })).request('/capabilities');

    expect(response.status).toBe(401);
  });

  it('serves the server-owned upload formats and limits', async () => {
    const response = await createApiApp(newApiDependencies({ users: newApiUsers() })).request('/capabilities', {
      headers: apiAuthHeaders(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      uploads: {
        activityExtensions: [...ACTIVITY_FILE_EXTENSIONS],
        imageExtensions: [...IMAGE_FILE_EXTENSIONS],
        videoExtensions: [...VIDEO_FILE_EXTENSIONS],
        limits: {
          activityFileBytes: UPLOAD_LIMITS.activityFileBytes,
          imageFileBytes: UPLOAD_LIMITS.imageFileBytes,
          avatarFileBytes: UPLOAD_LIMITS.avatarFileBytes,
          zipEntries: UPLOAD_LIMITS.zipEntries,
          zipEntryBytes: UPLOAD_LIMITS.zipEntryBytes,
          zipExpandedBytes: UPLOAD_LIMITS.zipExpandedBytes,
          zipCompressionRatio: UPLOAD_LIMITS.zipCompressionRatio,
          manifestBytes: UPLOAD_LIMITS.manifestBytes,
          manifestRows: UPLOAD_LIMITS.manifestRows,
        },
      },
    });
  });

  it('builds the response from the server-owned constants', () => {
    const capabilities = buildCapabilities();

    expect(capabilities.uploads.activityExtensions).toEqual([...ACTIVITY_FILE_EXTENSIONS]);
    expect(capabilities.uploads.limits.activityFileBytes).toBe(UPLOAD_LIMITS.activityFileBytes);
    expect(capabilities.uploads.limits.manifestRows).toBe(UPLOAD_LIMITS.manifestRows);
  });

  it('is exposed by the Worker portable route groups', async () => {
    const app = createApiShell(newApiDependencies({ users: newApiUsers() }).sessions);
    registerWorkerPortableRouteGroups(app, {
      activities: {} as never,
      jobs: {} as never,
      liveActivities: {} as never,
      social: {} as never,
      users: newApiUsers(),
    });

    const response = await app.request('/capabilities', { headers: apiAuthHeaders() });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(buildCapabilities());
  });
});
