import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL;

if (!serverUrl) {
  throw new Error('KONDIS_E2E_SERVER_URL must be set');
}

const fixtureSegments = ['test', 'test-assets', 'activities', 'running', '2015-hindas', '2015-06-22-run.fit'];
const fixtureCandidates = [
  resolve(process.cwd(), '..', ...fixtureSegments),
  resolve(process.cwd(), ...fixtureSegments),
  resolve(process.cwd(), '..', '..', ...fixtureSegments),
];
const fixturePath = fixtureCandidates.find((path) => existsSync(path)) ?? fixtureCandidates[0];

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';

type ActivityDto = {
  id: string;
  uploadId: string;
  sport: string;
  subSport: string | null;
  name: string | null;
  startedAt: string;
};

const uploadFitFixture = async (): Promise<{ id: string }> => {
  const formData = new FormData();
  const bytes = await readFile(fixturePath);
  formData.append('file', new Blob([bytes], { type: 'application/octet-stream' }), '2015-06-22-run.fit');

  const response = await fetch(`${serverUrl}/uploads/fit`, {
    method: 'POST',
    body: formData,
  });

  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
};

const listActivities = async (): Promise<ActivityDto[]> => {
  const response = await fetch(`${serverUrl}/activities`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { activities: ActivityDto[] };
  return body.activities;
};

const waitForActivity = async (uploadId: string, timeoutMs = 25_000): Promise<ActivityDto> => {
  const startedAt = Date.now();
  for (;;) {
    const activities = await listActivities();
    const found = activities.find((activity) => activity.uploadId === uploadId);
    if (found) {
      return found;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for activity for upload ${uploadId}`);
    }

    await new Promise((resolveLoop) => setTimeout(resolveLoop, 300));
  }
};

describe('Activities API', () => {
  it('lists, updates, and deletes a parsed activity', async () => {
    const upload = await uploadFitFixture();
    const activity = await waitForActivity(upload.id);

    const updatedAt = '2024-01-02T03:04:05.000Z';
    const updateResponse = await fetch(`${serverUrl}/activities/${activity.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'e2e-updated-name',
        sport: 'running',
        subSport: 'recovery',
        startedAt: updatedAt,
      }),
    });

    expect(updateResponse.status).toBe(200);
    const updated = (await updateResponse.json()) as ActivityDto;
    expect(updated.id).toBe(activity.id);
    expect(updated.name).toBe('e2e-updated-name');
    expect(updated.subSport).toBe('recovery');
    expect(updated.startedAt).toBe(updatedAt);

    const deleteResponse = await fetch(`${serverUrl}/activities/${activity.id}`, { method: 'DELETE' });
    expect(deleteResponse.status).toBe(204);

    const remaining = await listActivities();
    expect(remaining.find((candidate) => candidate.id === activity.id)).toBeUndefined();
  }, 30_000);

  it('returns 404 for update and delete of a missing activity', async () => {
    const updateResponse = await fetch(`${serverUrl}/activities/${MISSING_UUID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'missing' }),
    });

    expect(updateResponse.status).toBe(404);

    const deleteResponse = await fetch(`${serverUrl}/activities/${MISSING_UUID}`, {
      method: 'DELETE',
    });

    expect(deleteResponse.status).toBe(404);
  });
});
