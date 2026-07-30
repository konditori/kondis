import { ConsoleLogger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';

import { ConfigService } from 'src/config/config.service';
import { type KondisDatabase } from 'src/db/database';
import { ImportController } from 'src/controllers/import.controller';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadService } from 'src/services/upload.service';
import { type UploadedFitFile } from 'src/types';

import { createMediumTestDatabase, truncateAllTables } from 'test/medium/test-db';

const hasMediumDb = Boolean(process.env.KONDIS_TEST_POSTGRES_URL);
const fixturePath = resolve(process.cwd(), '..', '..', 'test', 'test-assets', 'activities', 'running', '2015-hindas', '2015-06-22-run.fit');

describe.skipIf(!hasMediumDb)('POST /uploads/fit', () => {
  const logger = new ConsoleLogger();
  const crypto = new CryptoRepository();
  const jobs = {
    queue: async () => {},
    startWorkers: async () => {},
    drain: async () => {},
  };

  let fileBuffer: Buffer<ArrayBuffer>;
  let storageDir = '';
  let db: KondisDatabase;
  let controller: ImportController;
  let uploadRepository: UploadRepository;
  let storageRepository: StorageRepository;

  beforeAll(async () => {
    fileBuffer = await readFile(fixturePath);
    db = createMediumTestDatabase();
    uploadRepository = new UploadRepository(db);

    storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-uploads-'));
    const config = { storageDir } as unknown as ConfigService;

    storageRepository = new StorageRepository(config, crypto);
    const service = new UploadService(uploadRepository, storageRepository, crypto, jobs, logger);
    controller = new ImportController(service);
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

  it('stores a .fit file and deduplicates identical content', async () => {
    const file = {
      originalname: '2015-06-22-run.fit',
      buffer: fileBuffer,
    } as UploadedFitFile;

    const first = await controller.uploadFit(file);

    expect(first.id).toBeTruthy();
    expect(first.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(first.byteSize).toBe(fileBuffer.length);

    const second = await controller.uploadFit(file);

    expect(second.id).toBe(first.id);
    expect(second.checksum).toBe(first.checksum);
    expect(second.duplicate).toBe(true);
  });
});