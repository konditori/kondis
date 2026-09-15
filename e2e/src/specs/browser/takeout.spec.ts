/* eslint-disable unicorn/no-null -- Missing API metrics are JSON null, not undefined. */
import type { Route } from '@playwright/test';
import {
  activityCount,
  expect,
  finishImport,
  getActivity,
  getStatus,
  listActivities,
  selectTakeout,
  startImport,
  test,
} from '../../browser/fixtures';
import { makeTakeout, manualName, runDescription, runName } from '../../fixtures/takeout';

test('imports a mixed takeout through the browser and opens the result @smoke', async ({ page }, info) => {
  const uploads: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/activities')) {
      uploads.push(request.postDataBuffer()?.toString() ?? '');
    }
  });
  await selectTakeout(page, await makeTakeout(info.outputPath('mixed.zip')));
  const id = await startImport(page);
  await finishImport(page, id);
  await expect(page.getByRole('status')).toHaveText('Imported 5 activities.');
  await expect(page.getByRole('note')).toHaveText('Skipped 1 videos. Photos and profile information are imported.');
  expect(uploads).toHaveLength(4);
  expect(uploads.join('')).not.toContain('synthetic video sentinel');
  expect(uploads.every((body) => !/filename="[^"]+\.(?:gz|zip)"/.test(body))).toBe(true);

  const { activities, total } = await listActivities(page);
  expect(total).toBe(5);
  const run = activities.find((activity) => activity.name === runName)!;
  expect(run).toMatchObject({ sport: 'trail_run', description: runDescription });
  expect(run.metrics?.distance).toBeGreaterThan(0);
  expect(activities.find((activity) => activity.name === 'Synthetic commute')).toMatchObject({
    sport: 'ride',
    tags: ['commute'],
    startedAt: '2030-01-01T10:00:00.000Z',
  });
  expect(activities.find((activity) => activity.name === 'Synthetic TCX run')).toMatchObject({
    metrics: { elapsedTime: 660, calories: 50 },
  });
  expect(activities.find((activity) => activity.name === manualName)).toMatchObject({
    sport: 'walk',
    startedAt: '2030-01-03T12:00:00.000Z',
    metrics: { elapsedTime: 1800, movingTime: 1500, distance: 2500, avgHr: null, maxHr: null, calories: null },
  });
  await expect
    .poll(async () => {
      const detail = await getActivity(page, run.id);
      return detail.images.filter((image) => image.status === 'ready').length;
    })
    .toBe(1);
  const manual = activities.find((activity) => activity.name === manualName)!;
  await expect
    .poll(async () => {
      const detail = await getActivity(page, manual.id);
      return detail.images.filter((image) => image.status === 'ready').length;
    })
    .toBe(1);
  const profile = await page.request.get('/api/v1/auth/me');
  const user = await profile.json();
  expect(user).toMatchObject({ firstName: 'Synthetic', lastName: 'Importer', email: 'browser@example.com' });
  const avatar = await page.request.get(user.avatarUrl as string);
  expect(avatar.ok()).toBe(true);
  expect(avatar.headers()['content-type']).toContain('image/');
  const detail = await getActivity(page, run.id);
  expect(detail.images[0]).toMatchObject({ caption: 'Synthetic, caption', width: 32, height: 24, status: 'ready' });
  for (const url of [detail.images[0].original, detail.images[0].thumbnail, detail.images[0].preview]) {
    expect(url).toBeTruthy();
    const image = await page.request.get(url!);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/');
  }
  expect(detail.track?.coordinates.length).toBeGreaterThan(0);
  expect(detail.analysis?.route.length).toBeGreaterThan(0);
  await page.goto(`/activities/${run.id}`);
  await expect(page.getByRole('heading', { name: runName, exact: true })).toBeVisible();
  const photo = page.getByRole('img', { name: 'Synthetic, caption', exact: true });
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
});

test('reimporting the selected file completes with duplicates', async ({ page }, info) => {
  await selectTakeout(page, await makeTakeout(info.outputPath('duplicates.zip')));
  const first = await startImport(page);
  await finishImport(page, first);
  const second = await startImport(page);
  expect(second).not.toBe(first);
  await finishImport(page, second, { total: 5, processed: 5, failed: 0, duplicates: 5 });
  await expect(page.getByRole('status')).toHaveText('5 activities were duplicates.');
  expect(await activityCount(page)).toBe(5);
});

test('imports a wrapper directory and ZIP64 @smoke', async ({ page }, info) => {
  await selectTakeout(page, await makeTakeout(info.outputPath('wrapped.zip'), { root: 'export/', zip64: true }));
  await finishImport(page, await startImport(page));
  expect(await activityCount(page)).toBe(5);
});

test('keeps valid activities and reports browser, manifest, and server failures', async ({ page }, info) => {
  await selectTakeout(page, await makeTakeout(info.outputPath('partial.zip'), { variant: 'partial' }));
  const id = await startImport(page);
  await finishImport(page, id, { total: 7, processed: 7, failed: 2, duplicates: 0 });
  await expect(page.getByRole('status')).toContainText('Imported 5 activities; 2 failed.');
  await expect(page.getByRole('status')).toContainText('1 archive entries could not be extracted');
  expect(await activityCount(page)).toBe(5);
});

for (const variant of ['corrupt', 'missing-manifest', 'ambiguous-manifest'] as const) {
  test(`rejects ${variant} and recovers with a valid archive`, async ({ page }, info) => {
    await selectTakeout(page, await makeTakeout(info.outputPath('invalid.zip'), { variant }));
    await startImport(page);
    await expect(page.getByRole('status')).toBeVisible();
    await expect(page.getByRole('status')).not.toHaveText('');
    expect(await activityCount(page)).toBe(0);
    await page
      .getByLabel('Strava takeout', { exact: true })
      .setInputFiles(await makeTakeout(info.outputPath('valid.zip')));
    await finishImport(page, await startImport(page));
  });
}

test('empty manifest completes without getting stuck', async ({ page }, info) => {
  await selectTakeout(page, await makeTakeout(info.outputPath('empty.zip'), { variant: 'empty' }));
  await finishImport(page, await startImport(page), { total: 0, processed: 0, failed: 0, duplicates: 0 });
  await expect(page.getByRole('status')).toHaveText('Imported 0 activities.');
});

// Hold the second file before it reaches the API. The preceding manual and raw FIT
// have been acknowledged; gzip consumes the full pool so later files cannot overtake it.
function gateUpload() {
  let release!: () => void;
  let reached!: () => void;
  const held = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  const handler = async (route: Route) => {
    if (!route.request().postDataBuffer()?.includes(Buffer.from('filename="short.fit"'))) {
      await route.continue();
      return;
    }
    reached();
    await released;
    try {
      await route.abort();
    } catch (error) {
      // Terminating the worker already cancels its held network request.
      if (!(error instanceof Error) || !error.message.includes('Route is already handled')) {
        throw error;
      }
    }
  };
  return { held, release, handler };
}

test('reload resumes the same import and sends only pending files', async ({ page, context }, info) => {
  const path = await makeTakeout(info.outputPath('resume.zip'));
  const gate = gateUpload();
  await context.route('**/upload/strava/imports/*/activities', gate.handler);
  try {
    await selectTakeout(page, path);
    const id = await startImport(page);
    await gate.held;
    await expect.poll(() => getStatus(page, id)).toMatchObject({ uploaded: 2 });
    await page.reload();
    gate.release();
    await context.unroute('**/upload/strava/imports/*/activities', gate.handler);
    const sent: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST') {
        sent.push(request.url());
      }
    });
    await page.getByLabel('Strava takeout', { exact: true }).setInputFiles(path);
    await page.getByRole('button', { name: 'Import takeout', exact: true }).click();
    await finishImport(page, id);
    expect(sent.filter((url) => url.endsWith('/activities'))).toHaveLength(3);
    expect(sent.some((url) => url.endsWith('/manual-activities') || url.endsWith('/imports'))).toBe(false);
    expect(await activityCount(page)).toBe(5);
  } finally {
    gate.release();
  }
});

test('cancel stops new submissions and allows a fresh import', async ({ page, context }, info) => {
  const gate = gateUpload();
  await context.route('**/upload/strava/imports/*/activities', gate.handler);
  try {
    await selectTakeout(page, await makeTakeout(info.outputPath('cancel.zip')));
    const id = await startImport(page);
    await gate.held;
    await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Import takeout', exact: true })).toBeEnabled();
    expect(await getStatus(page, id)).toMatchObject({ status: 'cancelled', uploaded: 2 });
    const scan = await page.request.post(`/api/v1/upload/strava/imports/${id}/scan`, { data: { items: [] } });
    expect(await scan.json()).toEqual({ pendingItemKeys: [] });
    gate.release();
    await context.unroute('**/upload/strava/imports/*/activities', gate.handler);
    const next = await startImport(page);
    expect(next).not.toBe(id);
    await finishImport(page, next, { total: 5, processed: 5, failed: 0, duplicates: 2 });
    expect(await getStatus(page, id)).toMatchObject({ status: 'cancelled' });
    expect(await activityCount(page)).toBe(5);
  } finally {
    gate.release();
  }
});

test('larger import remains responsive @scale', async ({ page }, info) => {
  test.skip(!process.env.KONDIS_E2E_SCALE, 'Scheduled or opt-in scale coverage');
  test.setTimeout(180_000);
  await selectTakeout(page, await makeTakeout(info.outputPath('large.zip'), { extraActivities: 100 }));
  const id = await startImport(page);
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toBeEnabled();
  // Browser main-thread interaction while the dedicated worker extracts the archive.
  await page.getByRole('button', { name: 'Cancel import', exact: true }).focus();
  await expect(page.getByRole('button', { name: 'Cancel import', exact: true })).toBeFocused();
  await expect
    .poll(() => getStatus(page, id), { timeout: 150_000 })
    .toMatchObject({ status: 'completed', total: 105, processed: 105, failed: 0 });
  expect(await activityCount(page)).toBe(105);
});
