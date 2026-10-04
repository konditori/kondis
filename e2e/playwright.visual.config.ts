import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/visual',
  testMatch: '**/*.spec.ts',
  outputDir: './test-results/visual',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:2411',
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'light',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node src/visual/serve.ts',
    url: 'http://127.0.0.1:2411/login',
    timeout: 60_000,
    reuseExistingServer: Boolean(process.env.KONDIS_VISUAL_REUSE_SERVER),
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  },
});
