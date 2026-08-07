import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const serverUrl = process.env.KONDIS_E2E_SERVER_URL;

if (!serverUrl) {
  throw new Error('KONDIS_E2E_SERVER_URL must be set');
}

const fitFixtureSegments = ['test', 'test-assets', 'activities', 'running', '2015-hindas', '2015-06-22-run.fit'];
const orsaTcxFixtureSegments = ['test', 'test-assets', 'activities', 'alpine-ski', '2013-01-13-orsa.tcx'];

const resolveFixturePath = (segments: string[]): string => {
  const candidates = [
    resolve(process.cwd(), '..', ...segments),
    resolve(process.cwd(), ...segments),
    resolve(process.cwd(), '..', '..', ...segments),
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0];
};

const fitFixturePath = resolveFixturePath(fitFixtureSegments);
const orsaTcxFixturePath = resolveFixturePath(orsaTcxFixtureSegments);

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';
const UPDATED_NAME = 'e2e-updated-name';
const UPDATED_SUB_SPORT = 'recovery';
const UPDATED_STARTED_AT = '2024-01-02T03:04:05.000Z';

type ActivityDto = {
  id: string;
  uploadId: string;
  sport: string;
  subSport: string | null;
  name: string | null;
  startedAt: string;
  elapsedTime: number;
  movingTime: number | null;
  distance: number | null;
  calories: number | null;
};

const uploadFixture = async (
  path: string,
  fileName: string,
  contentType = 'application/octet-stream',
): Promise<{ id: string }> => {
  const formData = new FormData();
  const bytes = await readFile(path);
  formData.append('file', new Blob([bytes], { type: contentType }), fileName);

  const response = await fetch(`${serverUrl}/uploads/activity`, {
    method: 'POST',
    body: formData,
  });

  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
};

const uploadFitFixture = async (): Promise<{ id: string }> => uploadFixture(fitFixturePath, '2015-06-22-run.fit');

const uploadOrsaTcxFixture = async (): Promise<{ id: string }> =>
  uploadFixture(orsaTcxFixturePath, '2013-01-13-orsa.tcx', 'application/xml');

const listActivities = async (): Promise<ActivityDto[]> => {
  const response = await fetch(`${serverUrl}/activities`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { activities: ActivityDto[] };
  return body.activities;
};

const updateActivity = async (
  id: string,
  payload: { name?: string; sport?: string; subSport?: string; startedAt?: string },
): Promise<Response> =>
  fetch(`${serverUrl}/activities/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

const deleteActivity = async (id: string): Promise<Response> =>
  fetch(`${serverUrl}/activities/${id}`, {
    method: 'DELETE',
  });

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

describe('GET /activities', () => {
  it('lists a parsed activity after upload processing completes', async () => {
    const upload = await uploadFitFixture();
    const activity = await waitForActivity(upload.id);

    const listed = await listActivities();
    expect(listed.find((candidate) => candidate.id === activity.id)).toBeDefined();
  });

  it('parses the Orsa TCX fixture with expected summary values', async () => {
    const upload = await uploadOrsaTcxFixture();
    const activity = await waitForActivity(upload.id);

    expect(activity.sport).toBe('other');
    expect(activity.startedAt).toBe('2013-01-13T09:17:34.000Z');
    expect(activity.elapsedTime).toBe(10_962);
    expect(activity.movingTime).toBe(10_962);
    expect(activity.distance).toBeCloseTo(29_823.963165283203, 3);
    expect(activity.calories).toBe(1690);
  });
});

describe('PUT /activities/:id', () => {
  it('updates the name field', async () => {
    const upload = await uploadFitFixture();
    const activity = await waitForActivity(upload.id);

    const response = await updateActivity(activity.id, { name: UPDATED_NAME });

    expect(response.status).toBe(200);
    const updated = (await response.json()) as ActivityDto;
    expect(updated.name).toBe(UPDATED_NAME);
  });

  it('updates the subSport and startedAt fields', async () => {
    const upload = await uploadFitFixture();
    const activity = await waitForActivity(upload.id);

    const response = await updateActivity(activity.id, {
      subSport: UPDATED_SUB_SPORT,
      startedAt: UPDATED_STARTED_AT,
    });

    expect(response.status).toBe(200);
    const updated = (await response.json()) as ActivityDto;
    expect(updated.subSport).toBe(UPDATED_SUB_SPORT);
    expect(updated.startedAt).toBe(UPDATED_STARTED_AT);
  });

  it('returns 404 for a missing activity id', async () => {
    const response = await updateActivity(MISSING_UUID, { name: 'missing' });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /activities/:id', () => {
  it('deletes an existing activity', async () => {
    const upload = await uploadFitFixture();
    const activity = await waitForActivity(upload.id);

    const response = await deleteActivity(activity.id);
    expect(response.status).toBe(204);

    const remaining = await listActivities();
    expect(remaining.find((candidate) => candidate.id === activity.id)).toBeUndefined();
  });

  it('returns 404 for a missing activity id', async () => {
    const response = await deleteActivity(MISSING_UUID);
    expect(response.status).toBe(404);
  });
});
