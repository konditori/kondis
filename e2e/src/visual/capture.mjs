import { chromium } from '@playwright/test';
import { resolve } from 'node:path';

// Run after the fixture server starts. These are real UI renders with fictional data.
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light' });
  await context.addCookies([{ name: 'kondis_session', value: 'normal', url: 'http://127.0.0.1:2411' }]);
  const page = await context.newPage();
  for (const [width, height, file] of [
    [1440, 960, 'kondis-dashboard-preview.png'],
    [390, 844, 'kondis-mobile-preview.png'],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:2411/');
    await page.locator('.activity-card').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.leaflet-container').first().waitFor();
    await page.waitForFunction(
      () => {
        const tiles = [...document.querySelectorAll('.leaflet-tile')];
        return tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0);
      },
      undefined,
      { timeout: 15000 },
    );
    await page.screenshot({ path: resolve(import.meta.dirname, '../../../sites/kondis.org/static', file) });
  }
} finally {
  await browser.close();
}
