import { defineConfig } from 'vitest/config';

const sdkPath = new URL('../server/src/open-api/fetch-client.ts', import.meta.url).pathname;
const serverUrl = process.env.KONDIS_E2E_SERVER_URL ?? 'http://127.0.0.1:2295';

process.env.KONDIS_E2E_SERVER_URL = serverUrl;

const skipDockerSetup = process.env.VITEST_DISABLE_DOCKER_SETUP === 'true';

// skip `docker compose up` if `make e2e` was already run or if VITEST_DISABLE_DOCKER_SETUP is set
const globalSetup: string[] = [];
if (!skipDockerSetup) {
  try {
    await fetch(`${serverUrl}/ping`);
  } catch {
    globalSetup.push('src/docker-compose.ts');
  }
}

export default defineConfig({
  resolve: {
    alias: {
      '@kondis/sdk': sdkPath,
    },
  },
  test: {
    name: 'e2e:server',
    retry: process.env.CI ? 4 : 0,
    include: ['src/specs/server/**/*.e2e-spec.ts'],
    setupFiles: ['src/specs/setup-sdk.ts'],
    globalSetup,
    testTimeout: 15_000,
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
  },
});
