import { ConsoleLogger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { JobStatus } from 'src/enum';
import { type JobRepository } from 'src/repositories/job.repository';
import { type StorageRepository } from 'src/repositories/storage.repository';
import { StorageService } from 'src/services/storage.service';

describe('StorageService', () => {
  it('protects temporary files referenced by runnable jobs during cleanup', async () => {
    const referenced = new Set(['temporary/pending.fit']);
    const getReferencedTemporaryPaths = vi.fn(() => Promise.resolve(referenced));
    const deleteTemporaryFilesOlderThan = vi.fn(() => Promise.resolve(['temporary/stale.fit']));
    const service = new StorageService(
      { deleteTemporaryFilesOlderThan } as unknown as StorageRepository,
      { getReferencedTemporaryPaths } as unknown as JobRepository,
      new ConsoleLogger({ logLevels: [] }),
    );

    await expect(service.handleTemporaryFileCleanup()).resolves.toBe(JobStatus.Success);
    expect(deleteTemporaryFilesOlderThan).toHaveBeenCalledWith(expect.any(Date), referenced);
  });
});
