import { describe, expect, it, vi } from 'vitest';

import type { JobRepository } from 'src/contracts/job.repository';
import type { StorageRepository } from 'src/contracts/storage.repository';
import { JobStatus } from 'src/enum';
import { ConsoleLogger } from 'src/logger';
import { StorageService } from 'src/services/storage.service';
import { newServiceDeps, newTestService } from 'test/utils';

const setup = () => {
  const mocks = {
    storageRepository: {
      deleteTemporaryFilesOlderThan: vi.fn(() => Promise.resolve(['temporary/stale.fit'])),
    } as unknown as StorageRepository,
    jobRepository: {
      getReferencedTemporaryPaths: vi.fn(() => Promise.resolve(new Set(['temporary/pending.fit']))),
    } as unknown as JobRepository,
    logger: new ConsoleLogger({ logLevels: [] }),
  };
  return newTestService(
    StorageService,
    [newServiceDeps({ storageRepository: mocks.storageRepository, jobRepository: mocks.jobRepository })],
    mocks,
  );
};

describe('StorageService', () => {
  it('protects temporary files referenced by runnable jobs during cleanup', async () => {
    const { sut, mocks } = setup();
    const referenced = new Set(['temporary/pending.fit']);

    await expect(sut.handleTemporaryFileCleanup()).resolves.toBe(JobStatus.Success);
    expect(mocks.storageRepository.deleteTemporaryFilesOlderThan).toHaveBeenCalledWith(expect.any(Date), referenced);
  });
});
