import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const browserErrors = new WeakMap<Page, string[]>();

async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) }))).toEqual([]);
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}
test.beforeEach(async ({ page, context }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await context.addCookies([{ name: 'kondis_session', value: 'normal', url: 'http://127.0.0.1:2411' }]);
  // Keep the fixture deterministic and offline, including map tiles and web fonts.
  await page.route(/https:\/\/(fonts\.(googleapis|gstatic)\.com|.*tile\.openstreetmap\.org)/, (route) => route.abort());
});
test.afterEach(({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});
for (const theme of ['light', 'dark'] as const) {
  for (const width of [1280, 390]) {
    test(`feed ${theme} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto('/');
      await ready(page);
      await expect(page.locator('.activity-card')).toHaveCount(2);
      const first = page.locator('.activity-card').first();
      await expect(first.locator('.activity-medal-stat')).toHaveCount(0);
      for (const key of ['distance', 'average', 'time']) {
        await expect(first.locator(`.stat-${key}`)).toBeVisible();
      }
      const metrics = await first.locator('.activity-feed-stats').boundingBox();
      expect(metrics?.width).toBeGreaterThan(width === 390 ? 250 : 200);
      await noOverflow(page);
      await accessible(page);
      await expect(page).toHaveScreenshot(`feed-${theme}-${width}.png`, {
        mask: [page.locator('.activity-card-map')],
        maxDiffPixelRatio: 0.01,
      });
      await info.attach('feed', { body: await page.screenshot(), contentType: 'image/png' });
    });
  }
  for (const path of ['/login', '/settings', '/activities/visual-run']) {
    test(`${path} ${theme}`, async ({ page }, info) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(path);
      await ready(page);
      await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue('system');
      await noOverflow(page);
      await accessible(page);
      await info.attach(path, { body: await page.screenshot(), contentType: 'image/png' });
    });
  }
  test(`documentation and API ${theme}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    for (const port of [2413, 2415]) {
      await page.goto(`http://127.0.0.1:${port}/`);
      await ready(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await noOverflow(page);
      await accessible(page);
      await info.attach(`docs-${port}`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    await page.goto('http://127.0.0.1:2414/');
    await ready(page);
    await expect(page.locator('.scalar-api-reference')).toBeVisible();
    const sidebar = page.getByRole('complementary', { name: 'Sidebar for Kondis API' });
    await expect(sidebar).toBeVisible();
    expect(
      await sidebar.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + 100);
        return element.contains(target);
      }),
    ).toBe(true);
    expect(
      await page
        .locator('.scalar-app')
        .evaluateAll((elements) =>
          elements
            .filter((element) => !element.classList.contains('scalar-api-reference'))
            .every((element) => getComputedStyle(element).minHeight === '0px'),
        ),
    ).toBe(true);
    await page.getByLabel('Appearance').selectOption(theme === 'dark' ? 'light' : 'dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'dark' ? 'light' : 'dark');
    await page.getByLabel('Appearance').selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await info.attach('api', { body: await page.screenshot(), contentType: 'image/png' });
  });
  test(`landing ${theme} mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('http://127.0.0.1:2412/');
    await ready(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your training.Your data.');
    await noOverflow(page);
    await accessible(page);
  });
}
test('appearance follows the system and retains explicit preference', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  const picker = page.getByLabel('Appearance', { exact: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await picker.selectOption('light');
  await page.reload();
  await expect(picker).toHaveValue('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await picker.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
test('mobile menus stay visible and support keyboard dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Add activity', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Upload activity', exact: true })).toBeVisible();
  await noOverflow(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Upload activity', exact: true })).not.toBeVisible();
});
for (const fixture of ['empty', 'unavailable']) {
  test(`${fixture} feed`, async ({ page, context }) => {
    await context.addCookies([{ name: 'kondis_session', value: fixture, url: 'http://127.0.0.1:2411' }]);
    await page.goto('/');
    await expect(page.locator('.activity-card')).toHaveCount(0);
    await expect(page.locator(fixture === 'empty' ? '.empty-state' : '.notice')).toBeVisible();
    await accessible(page);
  });
}
test.describe('Swedish locale', () => {
  test.use({ locale: 'sv-SE' });
  test('Swedish HTML matches hydration and client navigation', async ({ page }) => {
    const response = await page.goto('/');
    expect(await response!.text()).toContain('<html lang="sv">');
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await expect(page.locator('.stat-average').first()).toContainText('Tempo');
    await expect(page.locator('.activity-tag').first()).toHaveText('Långpass');
    await page.locator('.activity-card-summary').first().click();
    await expect(page.locator('h1')).toHaveText('Morning run');
    await expect(page.getByLabel('Utseende', { exact: true })).toBeVisible();
  });
});
test('long feed only initializes maps near the viewport', async ({ page, context }, info) => {
  await context.addCookies([{ name: 'kondis_session', value: 'long-feed', url: 'http://127.0.0.1:2411' }]);
  const started = Date.now();
  await page.goto('/');
  await expect(page.locator('.activity-card')).toHaveCount(200);
  await expect(page.locator('.leaflet-container').first()).toBeVisible();
  const maps = await page.locator('.leaflet-container').count();
  expect(maps).toBeLessThan(10);
  await info.attach('feed-performance', {
    body: JSON.stringify({ activities: 200, maps, readyMs: Date.now() - started }),
    contentType: 'application/json',
  });
  await page.locator('.activity-card').nth(100).scrollIntoViewIfNeeded();
  await expect(page.locator('.activity-card').nth(100).locator('.leaflet-container')).toBeVisible();
});

test('photo viewer traps focus, changes photos and restores focus', async ({ page }) => {
  await page.goto('/activities/visual-photos');
  const open = page.getByRole('button', { name: 'Sample route photo 1' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Sample route photo 1' });
  await expect(dialog).toBeVisible();
  await accessible(page);
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Sample route photo 2');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(open).toBeFocused();
});
test('appearance remains usable without local storage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('Storage disabled');
    };
    Storage.prototype.setItem = () => {
      throw new Error('Storage disabled');
    };
    Storage.prototype.removeItem = () => {
      throw new Error('Storage disabled');
    };
  });
  await page.goto('/login');
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('canvas map colors follow appearance changes', async ({ page }) => {
  await page.goto('/');
  const canvas = page.locator('.activity-card-map canvas').first();
  await expect(canvas).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Appearance', { exact: true }).selectOption(theme);
    await expect
      .poll(() =>
        canvas.evaluate((element) => {
          const hex = getComputedStyle(document.documentElement).getPropertyValue('--chart-route').trim();
          const expected = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
          const pixels = (element as HTMLCanvasElement)
            .getContext('2d')!
            .getImageData(0, 0, (element as HTMLCanvasElement).width, (element as HTMLCanvasElement).height).data;
          let matches = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            if (expected.every((value, channel) => pixels[index + channel] === value) && pixels[index + 3] === 255) {
              matches++;
            }
          }
          return matches;
        }),
      )
      .toBeGreaterThan(20);
  }
});
