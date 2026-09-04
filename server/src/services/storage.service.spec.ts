import { describe, expect, it, vi } from 'vitest';

import { JobStatus } from 'src/enum';
import { ConsoleLogger } from 'src/logger';
import { StorageService } from 'src/services/storage.service';
import { newTestService } from 'test/utils';

const setup = () => {
  const mocks = {
    storageRepository: { deleteTemporaryFilesOlderThan: vi.fn(() => Promise.resolve(['temporary/stale.fit'])) },
    jobRepository: { getReferencedTemporaryPaths: vi.fn(() => Promise.resolve(new Set(['temporary/pending.fit']))) },
    logger: new ConsoleLogger({ logLevels: [] }),
  };
  return newTestService(StorageService, [mocks.storageRepository, mocks.jobRepository, mocks.logger], mocks);
};

describe('StorageService', () => {
  it('protects temporary files referenced by runnable jobs during cleanup', async () => {
    const { sut, mocks } = setup();
    const referenced = new Set(['temporary/pending.fit']);

    await expect(sut.handleTemporaryFileCleanup()).resolves.toBe(JobStatus.Success);
    expect(mocks.storageRepository.deleteTemporaryFilesOlderThan).toHaveBeenCalledWith(expect.any(Date), referenced);
  });
});
