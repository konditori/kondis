import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { JobStatus } from 'src/enum';
import { StorageRepository } from 'src/repositories/storage.repository';
import { StorageService } from 'src/services/storage.service';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(StorageService.name, () => {
  let testApp: TestApp;
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  const setup = () => ({ sut: testApp.get(StorageService), repository: testApp.get(StorageRepository) });

  it('deletes files through the configured storage repository', async () => {
    const { sut, repository } = setup();
    const path = repository.buildTemporaryPath('.fit');
    const contents = Buffer.from('medium storage test');

    await repository.write(path, contents);
    await expect(sut.handleFileDelete({ paths: [path] })).resolves.toBe(JobStatus.Success);
    await expect(repository.read(path)).rejects.toThrow();
  });

  it('runs temporary-file cleanup while preserving referenced paths', async () => {
    const { sut } = setup();
    await expect(sut.handleTemporaryFileCleanup()).resolves.toBe(JobStatus.Success);
  });
});
