import { ConsoleLogger } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConfigService } from 'src/config/config.service';
import { type KondisDatabase } from 'src/db/database';
import { JobName } from 'src/enum';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { type JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadService } from 'src/services/upload.service';
import { type UploadedFitFile } from 'src/types';

import { createMediumTestDatabase, truncateAllTables } from 'test/medium/test-db';

const hasMediumDb = Boolean(process.env.KONDIS_TEST_POSTGRES_URL);

describe.skipIf(!hasMediumDb)('UploadService (medium)', () => {
  const logger = new ConsoleLogger();
  const crypto = new CryptoRepository();
  const queue = vi.fn(async () => {});
  const jobs = { queue } as unknown as JobRepository;

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
    uploadService = new UploadService(
      uploadRepository,
      storageRepository,
      crypto,
      new DatabaseRepository(db),
      jobs,
      logger,
    );
  });

  beforeEach(async () => {
    queue.mockClear();
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

  it('stores a .fit file and queues a parse in the same transaction', async () => {
    const buffer = Buffer.from('not really a fit file, but the bytes are never read here');
    const file = { originalname: 'ride.fit', buffer, size: buffer.length } as UploadedFitFile;

    const result = await uploadService.uploadFit(file);

    expect(result.duplicate).toBe(false);
    expect(result.byteSize).toBe(buffer.length);

    expect(queue).toHaveBeenCalledTimes(1);
    const [item, options] = queue.mock.calls[0] as unknown as [unknown, { transaction?: unknown }];
    expect(item).toEqual({ name: JobName.ActivityParse, data: { id: result.id } });
    expect(options.transaction).toBeDefined();
  });

  it('deduplicates identical content without queueing again', async () => {
    const buffer = Buffer.from('identical bytes');
    const file = { originalname: 'ride.fit', buffer, size: buffer.length } as UploadedFitFile;

    const first = await uploadService.uploadFit(file);
    queue.mockClear();

    const second = await uploadService.uploadFit(file);

    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
    expect(queue).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a supported activity file', async () => {
    const buffer = Buffer.from('nope');
    const file = { originalname: 'ride.lol', buffer, size: buffer.length } as UploadedFitFile;

    await expect(uploadService.uploadFit(file)).rejects.toThrow('Only .fit, .tcx and .gpx files are accepted');
  });
});
