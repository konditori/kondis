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

  it('queues a .fit upload without checksumming or storing it in the request', async () => {
    const buffer = Buffer.from('not really a fit file, but the bytes are never read here');
    const file = makeUploadedFile('ride.fit', buffer);

    const result = await uploadService.uploadFit(file);

    expect(result).toEqual({ byteSize: buffer.length, queued: true });
    expect(queue).toHaveBeenCalledTimes(1);
    expect(queue).toHaveBeenCalledWith({
      name: JobName.ActivityUpload,
      data: { originalName: 'ride.fit', contents: buffer.toString('base64') },
    });
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);
  });

  it('stores, deduplicates and queues parsing inside the activity upload job', async () => {
    const buffer = Buffer.from('identical bytes');
    const data = { originalName: 'ride.fit', contents: buffer.toString('base64') };

    await expect(uploadService.handleActivityUpload(data)).resolves.toBe('success');
    const stored = await uploadRepository.getByChecksum(crypto.xxHash(buffer));
    expect(stored).toBeDefined();
    expect(queue).toHaveBeenCalledTimes(1);
    const [item, options] = queue.mock.calls[0] as unknown as [unknown, { transaction?: unknown }];
    expect(item).toEqual({ name: JobName.ActivityParse, data: { id: stored!.id } });
    expect(options.transaction).toBeDefined();

    queue.mockClear();
    await expect(uploadService.handleActivityUpload(data)).resolves.toBe('skipped');
    expect(queue).not.toHaveBeenCalled();
  });

  it('stores a real .fit fixture from the queued activity upload', async () => {
    const fixture = activityFixtures.hindasRun;
    const file = makeUploadedFile(fixture.filename, await readFile(fixture.path));

    await expect(
      uploadService.handleActivityUpload({ originalName: file.originalname, contents: file.buffer.toString('base64') }),
    ).resolves.toBe('success');

    const stored = await uploadRepository.getByChecksum(crypto.xxHash(file.buffer));
    expect(stored?.checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(stored?.byte_size).toBe(file.buffer.length);
  });

  it('rejects anything that is not a supported activity file', async () => {
    const buffer = Buffer.from('nope');
    const file = makeUploadedFile('ride.lol', buffer);

    await expect(uploadService.uploadFit(file)).rejects.toThrow('Only .fit, .tcx and .gpx files are accepted');
  });

  it('stores a Lagom takeout and queues its import without extracting it', async () => {
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

    const first = await uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(first).toEqual({ byteSize: archive.length, queued: true });
    expect(queue).toHaveBeenCalledTimes(1);
    const [item] = queue.mock.calls[0] as unknown as [
      { name: JobName; data: { originalName: string; contents: string } },
    ];
    expect(item).toEqual({
      name: JobName.LagomTakeoutImport,
      data: {
        originalName: 'export.zip',
        contents: archive.toString('base64'),
      },
    });
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);

    queue.mockClear();
    await expect(uploadService.handleLagomTakeout(item.data)).resolves.toBe('success');
    expect(queue).toHaveBeenCalledTimes(2);

    queue.mockClear();
    const second = await uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(second).toEqual(first);
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('defers validation of ZIP contents to the takeout import job', async () => {
    const result = await uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', Buffer.from('nope')));

    expect(result.queued).toBe(true);
    const [item] = queue.mock.calls[0] as unknown as [{ data: { originalName: string; contents: string } }];
    await expect(uploadService.handleLagomTakeout(item.data)).rejects.toThrow();
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);
  });

  it('rejects a non-ZIP Lagom takeout upload', async () => {
    await expect(
      uploadService.uploadLagomTakeout(makeUploadedFile('activities.csv', Buffer.from('nope'))),
    ).rejects.toThrow('Only a Lagom takeout .zip file is accepted');
  });
});
