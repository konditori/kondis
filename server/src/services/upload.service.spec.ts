import { ConsoleLogger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobName } from 'src/enum';
import { LagomTakeoutParser } from 'src/imports/lagom-takeout.parser';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import type { DatabaseRepository } from 'src/repositories/database.repository';
import type { JobRepository } from 'src/repositories/job.repository';
import type { StorageRepository } from 'src/repositories/storage.repository';
import type { UploadRepository } from 'src/repositories/upload.repository';
import { UploadService } from 'src/services/upload.service';
import { ImportProgressStore } from 'src/state/import-progress.store';
import { newTestService } from 'test/utils';

describe(UploadService.name, () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const queue = vi.fn(async () => {});
  const write = vi.fn(async () => {});
  const importFile = vi.fn(async () => {});
  const buildTemporaryPath = vi.fn((extension: string) => `temporary/file${extension}`);
  const xxHash = vi.fn(() => 'a'.repeat(32));
  const mocks = {
    uploadRepository: {} as UploadRepository,
    storageRepository: { write, importFile, buildTemporaryPath } as unknown as StorageRepository,
    cryptoRepository: { xxHash } as unknown as CryptoRepository,
    databaseRepository: {} as DatabaseRepository,
    jobRepository: { queue } as unknown as JobRepository,
    logger: new ConsoleLogger({ logLevels: [] }),
    lagomTakeoutParser: new LagomTakeoutParser(),
    importProgressStore: new ImportProgressStore(),
  };
  const setup = () => newTestService(UploadService, Object.values(mocks), mocks);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues supported activity uploads', async () => {
    const { sut } = setup();
    const file = { originalname: 'run.fit', buffer: Buffer.from('fit bytes'), size: 9 };

    await expect(sut.uploadActivity(file, userId)).resolves.toEqual({ byteSize: file.buffer.length, queued: true });
    expect(write).toHaveBeenCalledWith('temporary/file.fit', file.buffer);
    expect(queue).toHaveBeenCalledWith({
      name: JobName.ActivityUpload,
      data: expect.objectContaining({ originalName: 'run.fit', checksum: 'a'.repeat(32) }),
    });
  });

  it('rejects unsupported activity extensions', async () => {
    const { sut } = setup();

    await expect(
      sut.uploadActivity({ originalname: 'run.txt', buffer: Buffer.from('x'), size: 1 }, userId),
    ).rejects.toThrow('Only .fit, .tcx and .gpx files are accepted');
  });

  it('moves disk-backed request uploads without buffering them in the API process', async () => {
    const { sut } = setup();
    const file = { originalname: 'run.gpx', path: '/tmp/request-upload', size: 123 };

    await expect(sut.uploadActivity(file, userId)).resolves.toEqual({ byteSize: 123, queued: true });

    expect(importFile).toHaveBeenCalledWith('/tmp/request-upload', 'temporary/file.gpx');
    expect(write).not.toHaveBeenCalled();
    expect(queue).toHaveBeenCalledWith({
      name: JobName.ActivityUpload,
      data: expect.objectContaining({ userId, originalName: 'run.gpx', storagePath: 'temporary/file.gpx' }),
    });
  });
});
