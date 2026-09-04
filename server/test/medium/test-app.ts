import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createApplicationComposition, type ApplicationComposition } from 'src/composition';

import { getTestDatabaseConfig } from 'test/medium/test-db';

export type TestApp = {
  app: ApplicationComposition;
  storageDir: string;
  get: <T>(token: new (...args: never[]) => T) => T;
  destroy: () => Promise<void>;
};

export const createTestApp = async (): Promise<TestApp> => {
  const database = getTestDatabaseConfig();
  const storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-app-'));

  // ConfigRepository reads the environment on first access, so this must happen before composition.
  Object.assign(process.env, {
    KONDIS_DB_HOSTNAME: database.host,
    KONDIS_DB_PORT: String(database.port),
    KONDIS_DB_USERNAME: database.user,
    KONDIS_DB_PASSWORD: database.password,
    KONDIS_DB_DATABASE_NAME: database.database,
    KONDIS_STORAGE_DIR: storageDir,
  });

  const app = createApplicationComposition({ role: 'worker' });
  try {
    await app.initialize();
  } catch (error) {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
    throw error;
  }

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
