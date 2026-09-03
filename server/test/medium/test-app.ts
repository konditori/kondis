import { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AppModule } from 'src/app.module';

import { TEST_JOB_SCHEMA, getTestDatabaseConfig } from 'test/medium/test-db';

export type TestApp = {
  app: INestApplicationContext;
  storageDir: string;
  get: <T>(token: new (...args: never[]) => T) => T;
  destroy: () => Promise<void>;
};

export const createTestApp = async (): Promise<TestApp> => {
  const database = getTestDatabaseConfig();
  const storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-app-'));

  // ConfigRepository reads the environment on first access, so this must happen before the
  // container is built.
  Object.assign(process.env, {
    DB_HOSTNAME: database.host,
    DB_PORT: String(database.port),
    DB_USERNAME: database.user,
    DB_PASSWORD: database.password,
    DB_DATABASE_NAME: database.database,
    KONDIS_STORAGE_DIR: storageDir,
    KONDIS_WORKERS: 'worker',
    // globalSetup already migrated; running it again here would just be slower.
    KONDIS_DB_AUTO_MIGRATE: 'false',
    KONDIS_JOB_SCHEMA: TEST_JOB_SCHEMA,
    // A cron tick firing mid-assertion would make these tests flaky for no coverage in return.
    KONDIS_JOB_CRON: 'false',
    // Deterministic ordering: with one worker per queue, a job either ran or it did not.
    KONDIS_JOB_CONCURRENCY: '1',
    // Fail fast. The default backoff would push a retry past any reasonable test timeout.
    KONDIS_JOB_RETRY_LIMIT: '1',
    KONDIS_JOB_RETRY_DELAY_SECONDS: '1',
  });

  const app = await NestFactory.createApplicationContext(AppModule, { abortOnError: false });

  return {
    app,
    storageDir,
    get: (token) => app.get(token),
    destroy: async () => {
      await app.close();
      await rm(storageDir, { recursive: true, force: true });
    },
  };
};
