import { ConsoleLogger } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
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

import { createMediumTestDatabase, truncateAllTables } from 'test/medium/test-db';
import { activityFixtures, makeUploadedFile } from 'test/medium/utils';
import { createTestZip } from 'test/utils/zip';

describe('UploadService (medium)', () => {
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
    const file = makeUploadedFile('ride.fit', buffer);

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
    const file = makeUploadedFile('ride.fit', buffer);

    const first = await uploadService.uploadFit(file);
    queue.mockClear();

    const second = await uploadService.uploadFit(file);

    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
    expect(queue).not.toHaveBeenCalled();
  });

  it('stores a real .fit fixture and deduplicates identical content', async () => {
    const fixture = activityFixtures.hindasRun;
    const file = makeUploadedFile(fixture.filename, await readFile(fixture.path));

    const first = await uploadService.uploadFit(file);

    expect(first.id).toBeTruthy();
    expect(first.checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(first.byteSize).toBe(file.buffer.length);

    queue.mockClear();
    const second = await uploadService.uploadFit(file);

    expect(second.id).toBe(first.id);
    expect(second.checksum).toBe(first.checksum);
    expect(second.duplicate).toBe(true);
    expect(queue).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a supported activity file', async () => {
    const buffer = Buffer.from('nope');
    const file = makeUploadedFile('ride.lol', buffer);

    await expect(uploadService.uploadFit(file)).rejects.toThrow('Only .fit, .tcx and .gpx files are accepted');
  });

  it('imports each supported activity listed in a Strava takeout', async () => {
    const fit = await readFile(activityFixtures.hindasRun.path);
    const gpx = await readFile(activityFixtures.sampleRun.path);
    const archive = createTestZip({
      'activities.csv': Buffer.from(
        [
          'Activity ID,Activity Name,Filename',
          '1,Run,activities/run.fit.gz',
          '2,Ride,activities/ride.gpx',
          '3,Manual,',
        ].join('\n'),
      ),
      'activities/run.fit.gz': gzipSync(fit),
      'activities/ride.gpx': gpx,
    });

    const first = await uploadService.uploadStravaTakeout(makeUploadedFile('export.zip', archive));

    expect(first).toMatchObject({ totalActivities: 3, imported: 2, duplicates: 0, skipped: 1, failed: 0 });
    expect(first.uploads).toHaveLength(2);
    expect(queue).toHaveBeenCalledTimes(2);

    queue.mockClear();
    const second = await uploadService.uploadStravaTakeout(makeUploadedFile('export.zip', archive));

    expect(second).toMatchObject({ totalActivities: 3, imported: 0, duplicates: 2, skipped: 1, failed: 0 });
    expect(queue).not.toHaveBeenCalled();
  });

  it('rejects a non-ZIP Strava takeout upload', async () => {
    await expect(
      uploadService.uploadStravaTakeout(makeUploadedFile('activities.csv', Buffer.from('nope'))),
    ).rejects.toThrow('Only a Strava takeout .zip file is accepted');
  });
});
