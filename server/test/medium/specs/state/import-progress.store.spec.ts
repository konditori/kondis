import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ImportProgressStore } from 'src/state/import-progress.store';

import { createMediumFactory } from 'test/medium.factory';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(ImportProgressStore.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(() => {
    db = createMediumTestDatabase();
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  it('shares progress between api and worker instances', async () => {
    const user = await createMediumFactory(db).newUser();
    const importId = randomUUID();
    const apiStore = new ImportProgressStore(db);
    const workerStore = new ImportProgressStore(db);

    await apiStore.create(importId, user.id);
    // A very small activity can finish before the takeout job has recorded its total.
    await workerStore.increment(importId, false, true);
    await workerStore.setProcessing(importId, 1);

    await expect(apiStore.get(importId, user.id)).resolves.toMatchObject({
      importId,
      status: 'completed',
      total: 1,
      processed: 1,
      failed: 0,
      duplicates: 1,
    });
  });
});
