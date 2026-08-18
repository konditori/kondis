import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ConsoleLogger } from '@nestjs/common';
import type { ConfigService } from 'src/config/config.service';
import { JobStatus } from 'src/enum';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import type { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { StorageService } from 'src/services/storage.service';

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(StorageService.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;
  let storageDir: string;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-storage-service-'));
  });

  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
    await rm(storageDir, { recursive: true, force: true });
  });

  const setup = () => {
    const repository = new StorageRepository({ storageDir } as ConfigService, new CryptoRepository());
    const jobs = { getReferencedTemporaryPaths: () => new Set<string>() } as unknown as JobRepository;
    return { sut: new StorageService(repository, jobs, new ConsoleLogger()), repository };
  };

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
