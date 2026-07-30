import { ConsoleLogger } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConfigService } from 'src/config/config.service';
import { type KondisDatabase } from 'src/db/database';
import { JobName } from 'src/jobs/job.types';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { type IJobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadService } from 'src/services/upload.service';
import { type UploadedFitFile } from 'src/types';

import { createMediumTestDatabase, truncateAllTables } from 'test/medium/test-db';

const hasMediumDb = Boolean(process.env.KONDIS_TEST_POSTGRES_URL);

describe.skipIf(!hasMediumDb)('UploadService (medium)', () => {
  const logger = new ConsoleLogger();
  const crypto = new CryptoRepository();
  const jobs: IJobRepository = {
    queue: vi.fn(async () => {}),
    startWorkers: vi.fn(async () => {}),
    drain: vi.fn(async () => {}),
  };

  let storageDir = '';
  let db: KondisDatabase;
  let uploadService: UploadService;
  let uploadRepository: UploadRepository;
  let storageRepository: StorageRepository;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    uploadRepository = new UploadRepository(db);

    storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-uploads-'));
    const config = { storageDir } as unknown as ConfigService;

    storageRepository = new StorageRepository(config, crypto);
    uploadService = new UploadService(uploadRepository, storageRepository, crypto, jobs, logger);
  });

  beforeEach(async () => {
    await truncateAllTables(db);
  });

  afterAll(async () => {
    if (db) {
      await db.destroy();
    }
    if (storageDir.length > 0) {
      await rm(storageDir, { recursive: true, force: true });
    }
  });

  it('persists a .fit upload and stores file bytes on disk', async () => {
    const file = {
      originalname: 'sample.fit',
      buffer: Buffer.from('fit-bytes-1'),
    } as UploadedFitFile;

    const result = await uploadService.uploadFit(file);

    expect(result.duplicate).toBe(false);

    const stored = await uploadRepository.getById(result.id);
    expect(stored).toBeDefined();
    expect(stored?.byte_size).toBe(file.buffer.length);
    expect(jobs.queue).toHaveBeenCalledWith({
      name: JobName.PARSE_ACTIVITY_FILE,
      data: { uploadId: result.id },
    });

    const readBack = await storageRepository.read(stored!.storage_path);
    expect(readBack.equals(file.buffer)).toBe(true);
  });

  it('deduplicates by checksum and returns the existing upload id', async () => {
    const file = {
      originalname: 'same.fit',
      buffer: Buffer.from('same-fit-bytes'),
    } as UploadedFitFile;

    const first = await uploadService.uploadFit(file);
    const second = await uploadService.uploadFit(file);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.id).toBe(first.id);
  });

  it('rejects non-fit uploads', async () => {
    await expect(
      uploadService.uploadFit({
        originalname: 'not-allowed.txt',
        buffer: Buffer.from('x'),
      } as UploadedFitFile),
    ).rejects.toThrow('Only .fit files are accepted');
  });
});
