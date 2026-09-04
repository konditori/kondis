import { describe, expect, it, vi } from 'vitest';

import { QueueName } from 'src/enum';
import { createHonoApp } from 'src/hono/app';
import { honoAuthHeaders, newHonoDependencies, newHonoUsers, TEST_HONO_USER } from 'test/hono';

const ADMIN = { ...TEST_HONO_USER, role: 'admin' as const };
const counts = { active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 };
const allStatus = Object.fromEntries(
  Object.values(QueueName).map((queue) => [queue, { jobCounts: counts, queueStatus: { paused: false } }]),
);

describe('Hono job routes', () => {
  it('rejects non-admin users before touching job administration', async () => {
    const getAllJobStatus = vi.fn();
    const response = await createHonoApp(
      newHonoDependencies({ jobs: { getAllJobStatus }, users: newHonoUsers() }),
    ).request('/jobs', { headers: honoAuthHeaders() });

    expect(response.status).toBe(403);
    expect(getAllJobStatus).not.toHaveBeenCalled();

    const invalidCommand = await createHonoApp(
      newHonoDependencies({ jobs: { getAllJobStatus }, users: newHonoUsers() }),
    ).request('/jobs/not-a-queue', { method: 'PUT', body: 'not json', headers: honoAuthHeaders() });
    expect(invalidCommand.status).toBe(403);
  });

  it('validates and delegates job administration for admins', async () => {
    const getAllJobStatus = vi.fn(() => Promise.resolve(allStatus as never));
    const getJobHistory = vi.fn(() => Promise.resolve({ jobs: [], total: 0 }));
    const create = vi.fn(() => Promise.resolve());
    const handleCommand = vi.fn(() => Promise.resolve({ jobCounts: counts, queueStatus: { paused: true } }));
    const app = createHonoApp(
      newHonoDependencies({
        jobs: { create, getAllJobStatus, getJobHistory, handleCommand },
        users: newHonoUsers(ADMIN),
      }),
    );
    const headers = { ...honoAuthHeaders(ADMIN), 'Content-Type': 'application/json' };

    await expect(app.request('/jobs', { headers })).resolves.toMatchObject({ status: 200 });
    await expect(app.request('/jobs/history?limit=10&offset=2', { headers })).resolves.toMatchObject({ status: 200 });
    expect(getJobHistory).toHaveBeenCalledWith(10, 2);

    const createResponse = await app.request('/jobs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'reparse-failed-uploads' }),
    });
    expect(createResponse.status).toBe(204);
    expect(create).toHaveBeenCalledWith('reparse-failed-uploads');

    const command = await app.request(`/jobs/${QueueName.ActivityParsing}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ command: 'pause' }),
    });
    expect(command.status).toBe(200);
    expect(handleCommand).toHaveBeenCalledWith(QueueName.ActivityParsing, 'pause');
  });
});
