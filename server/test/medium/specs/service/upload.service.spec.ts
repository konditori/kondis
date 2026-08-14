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

  it('checksums and stages an activity before queueing it', async () => {
    const buffer = Buffer.from('not really a fit file, but parsing happens in a later job');
    const file = makeUploadedFile('ride.fit', buffer);

    const result = await uploadService.uploadActivity(file);

    expect(result).toEqual({ byteSize: buffer.length, queued: true });
    expect(queue).toHaveBeenCalledTimes(1);
    const [item] = queue.mock.calls[0] as unknown as [
      { name: JobName; data: { originalName: string; storagePath: string; checksum: string; activityName?: string } },
    ];
    expect(item).toEqual({
      name: JobName.ActivityUpload,
      data: {
        originalName: 'ride.fit',
        storagePath: expect.stringMatching(/^temporary\/.+\.fit$/),
        checksum: crypto.xxHash(buffer),
      },
    });
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(buffer);
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);
  });

  it('stores, deduplicates and queues parsing inside the activity upload job', async () => {
    const buffer = Buffer.from('identical bytes');
    const storagePath = storageRepository.buildTemporaryPath('.fit');
    await storageRepository.write(storagePath, buffer);
    const data = {
      originalName: 'ride.fit',
      storagePath,
      checksum: crypto.xxHash(buffer),
    };

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

    await expect(
      uploadService.handleActivityUpload({
        ...data,
        activityName: 'A nice workout',
        activitySport: 'roller_ski',
      }),
    ).resolves.toBe('skipped');
    expect(queue).not.toHaveBeenCalled();
  });

  it('stores a real .fit fixture from the queued activity upload', async () => {
    const fixture = activityFixtures.hindasRun;
    const file = makeUploadedFile(fixture.filename, await readFile(fixture.path));
    const storagePath = storageRepository.buildTemporaryPath('.fit');
    await storageRepository.write(storagePath, file.buffer);

    await expect(
      uploadService.handleActivityUpload({
        originalName: file.originalname,
        storagePath,
        checksum: crypto.xxHash(file.buffer),
      }),
    ).resolves.toBe('success');

    const stored = await uploadRepository.getByChecksum(crypto.xxHash(file.buffer));
    expect(stored?.checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(stored?.byte_size).toBe(file.buffer.length);
  });

  it('rejects a staged activity whose contents no longer match its checksum', async () => {
    const storagePath = storageRepository.buildTemporaryPath('.fit');
    await storageRepository.write(storagePath, Buffer.from('changed'));

    await expect(
      uploadService.handleActivityUpload({
        originalName: 'ride.fit',
        storagePath,
        checksum: crypto.xxHash(Buffer.from('original')),
      }),
    ).rejects.toThrow('Activity upload checksum mismatch');
    expect(queue).not.toHaveBeenCalled();
  });

  it('rejects anything that is not a supported activity file', async () => {
    const buffer = Buffer.from('nope');
    const file = makeUploadedFile('ride.lol', buffer);

    await expect(uploadService.uploadActivity(file)).rejects.toThrow('Only .fit, .tcx and .gpx files are accepted');
  });

  it('leaves a staged activity for cleanup when queueing its upload fails', async () => {
    const contents = Buffer.from('activity');
    queue.mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(uploadService.uploadActivity(makeUploadedFile('ride.fit', contents))).rejects.toThrow(
      'queue unavailable',
    );

    const [item] = queue.mock.calls[0] as unknown as [{ data: { storagePath: string } }];
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(contents);
  });

  it('stages a Strava takeout and queues its path without extracting it', async () => {
    const fit = await readFile(activityFixtures.hindasRun.path);
    const gpx = await readFile(activityFixtures.sampleRun.path);
    const archive = createTestZip({
      'activities.csv': Buffer.from(
        [
          'Activity ID,Activity Date,Activity Name,Activity Description,Activity Type,Filename,Elapsed Time',
          '1,"Aug 11, 2016, 5:00:00 PM",Run,Forest loop,Roller Ski,activities/run.fit.gz,100',
          '2,"Aug 12, 2016, 5:00:00 PM",Ride,,Ride,activities/ride.gpx,100',
          '3,"Aug 10, 2016, 5:00:00 PM",Manual,,Run,,1495',
        ].join('\n'),
      ),
      'activities/run.fit.gz': gzipSync(fit),
      'activities/ride.gpx': gpx,
    });

    const first = await uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(first).toEqual({ byteSize: archive.length, queued: true, importId: expect.any(String) });
    expect(queue).toHaveBeenCalledTimes(1);
    const [item] = queue.mock.calls[0] as unknown as [
      { name: JobName; data: { originalName: string; storagePath: string } },
    ];
    expect(item).toEqual({
      name: JobName.LagomTakeoutImport,
      data: {
        originalName: 'export.zip',
        storagePath: expect.stringMatching(/^temporary\/.+\.zip$/),
        takeoutImportId: first.importId,
      },
    });
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(archive);
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);

    queue.mockClear();
    await expect(uploadService.handleLagomTakeout(item.data)).resolves.toBe('success');
    expect(queue).toHaveBeenCalledTimes(3);
    const [fitJob] = queue.mock.calls[0] as unknown as [
      { name: JobName; data: { originalName: string; storagePath: string; checksum: string } },
    ];
    const [gpxJob] = queue.mock.calls[1] as unknown as [
      { name: JobName; data: { originalName: string; storagePath: string; checksum: string } },
    ];
    const [manualJob] = queue.mock.calls[2] as unknown as [{ name: JobName; data: { activityName: string } }];
    expect(manualJob.name).toBe(JobName.ActivityManualCreate);
    expect(manualJob.data.activityName).toBe('Manual');
    expect(fitJob).toEqual({
      name: JobName.ActivityUpload,
      data: {
        originalName: 'run.fit',
        storagePath: expect.stringMatching(/^temporary\/.+\.fit$/),
        checksum: crypto.xxHash(fit),
        activityName: 'Run',
        activityDescription: 'Forest loop',
        activitySport: 'roller_ski',
      },
    });
    expect(gpxJob).toEqual({
      name: JobName.ActivityUpload,
      data: {
        originalName: 'ride.gpx',
        storagePath: expect.stringMatching(/^temporary\/.+\.gpx$/),
        checksum: crypto.xxHash(gpx),
        activityName: 'Ride',
        activitySport: 'ride',
      },
    });
    await expect(storageRepository.read(fitJob.data.storagePath)).resolves.toEqual(fit);
    await expect(storageRepository.read(gpxJob.data.storagePath)).resolves.toEqual(gpx);
    queue.mockClear();
    const second = await uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(second).toEqual({ byteSize: archive.length, queued: true, importId: expect.any(String) });
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('defers validation of ZIP contents to the takeout import job', async () => {
    const archive = Buffer.from('nope');
    const result = await uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(result.queued).toBe(true);
    const [item] = queue.mock.calls[0] as unknown as [{ data: { originalName: string; storagePath: string } }];
    await expect(uploadService.handleLagomTakeout(item.data)).rejects.toThrow();
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(archive);
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);
  });

  it('leaves a staged takeout for cleanup when queueing its import fails', async () => {
    const archive = Buffer.from('archive');
    queue.mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(uploadService.uploadLagomTakeout(makeUploadedFile('export.zip', archive))).rejects.toThrow(
      'queue unavailable',
    );

    const [item] = queue.mock.calls[0] as unknown as [{ data: { storagePath: string } }];
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(archive);
  });

  it('rejects a non-ZIP Strava takeout upload', async () => {
    await expect(
      uploadService.uploadLagomTakeout(makeUploadedFile('activities.csv', Buffer.from('nope'))),
    ).rejects.toThrow('Only a Strava takeout .zip file is accepted');
  });
});
