import type { ActivityDetailDtoOutput, ActivityListResponseDtoOutput, TakeoutImportStatusDtoOutput } from '@kondis/sdk';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

type AuthState = Awaited<ReturnType<BrowserContext['storageState']>>;
export const test = base.extend<{ imports: Set<string> }, { authState: AuthState }>({
  authState: [
    async ({ browser }, use) => {
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:2396/login');
      await page.getByLabel('Email', { exact: true }).fill('browser@example.com');
      await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL('http://127.0.0.1:2396/');
      const state = await page.context().storageState();
      await page.close();
      await use(state);
    },
    { scope: 'worker' },
  ],
  storageState: ({ authState }, use) => use(authState),
  imports: [
    async ({ page }, use, info) => {
      const ids = new Set<string>();
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      page.on('request', (request) => {
        const match = new URL(request.url()).pathname.match(/\/upload\/strava\/imports\/([\da-f-]{36})/);
        if (match) {
          ids.add(match[1]);
        }
      });
      await use(ids);
      const snapshots = await Promise.all([...ids].map((id) => getStatus(page, id)));
      if (info.status !== info.expectedStatus) {
        await info.attach('import-status', {
          body: JSON.stringify(snapshots, undefined, 2),
          contentType: 'application/json',
        });
        await info.attach('browser-errors', { body: errors.join('\n'), contentType: 'text/plain' });
      }
      // Stop browser work before draining accepted jobs, then delete only this test account's activities.
      await page.goto('about:blank');
      for (const status of snapshots) {
        if (!['completed', 'cancelled'].includes(status.status)) {
          await page.request.post(`/api/v1/upload/strava/imports/${status.importId}/cancel`);
        }
        await expect
          .poll(async () => {
            const current = await getStatus(page, status.importId);
            return current.processed >= current.uploaded;
          })
          .toBe(true);
      }
      // Delete serially: concurrent cascading activity deletes can deadlock in
      // activity_route_match, and cleanup must be deterministic.
      for (;;) {
        const { activities } = await listActivities(page);
        if (activities.length === 0) {
          break;
        }
        for (const { id } of activities) {
          const response = await page.request.delete(`/api/v1/activities/${id}`);
          expect(response.ok()).toBe(true);
        }
      }
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

async function read<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(`/api/v1${path}`);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<T>;
}
export const getStatus = (page: Page, id: string) =>
  read<TakeoutImportStatusDtoOutput>(page, `/upload/strava/imports/${id}`);
export const listActivities = (page: Page) => read<ActivityListResponseDtoOutput>(page, '/activities');
export const getActivity = (page: Page, id: string) => read<ActivityDetailDtoOutput>(page, `/activities/${id}`);

export async function selectTakeout(page: Page, path: string) {
  await page.goto('/upload');
  await page.getByRole('link', { name: /Strava takeout/ }).click();
  await page.getByLabel('Strava takeout', { exact: true }).setInputFiles(path);
}
export async function startImport(page: Page): Promise<string> {
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/upload/strava/imports') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Import takeout', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  return ((await response.json()) as { importId: string }).importId;
}
const successfulImport = { total: 5, processed: 5, failed: 0, duplicates: 0 };
export async function finishImport(page: Page, id: string, counts = successfulImport) {
  await expect.poll(() => getStatus(page, id)).toMatchObject({ status: 'completed', ...counts });
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import takeout', exact: true })).toBeEnabled();
}

export { expect } from '@playwright/test';

export async function activityCount(page: Page) {
  const result = await listActivities(page);
  return result.total;
}
