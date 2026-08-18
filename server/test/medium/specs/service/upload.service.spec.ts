import { ConsoleLogger } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConfigService } from 'src/config/config.service';
import { type KondisDatabase } from 'src/db/database';
import { JobName, QueueName } from 'src/enum';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadService } from 'src/services/upload.service';

import { makeUploadedFile } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { activityFixtures } from 'test/medium/utils';
import { createTestZip } from 'test/utils/zip';

describe(UploadService.name, () => {
  const logger = new ConsoleLogger();
  const crypto = new CryptoRepository();
  const queue = vi.fn(async () => {});
  const jobs = { queue } as unknown as JobRepository;

  let storageDir = '';
  let db: KondisDatabase;
  let sut: UploadService;
  let uploadRepository: UploadRepository;
  let storageRepository: StorageRepository;
  let testApp: TestApp;
  let queuedSut: UploadService;
  let jobsRepository: JobRepository;
  let queuedUploadRepository: UploadRepository;
  let activityRepository: ActivityRepository;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    uploadRepository = new UploadRepository(db);

    storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-uploads-'));
    const config = { storageDir } as unknown as ConfigService;

    storageRepository = new StorageRepository(config, crypto);
    sut = new UploadService(uploadRepository, storageRepository, crypto, new DatabaseRepository(db), jobs, logger);

    testApp = await createTestApp();
    queuedSut = testApp.get(UploadService);
    jobsRepository = testApp.get(JobRepository);
    queuedUploadRepository = testApp.get(UploadRepository);
    activityRepository = testApp.get(ActivityRepository);
  });

  beforeEach(async () => {
    queue.mockClear();
    await resetMediumTestDatabase(db, jobsRepository);
  });

  afterAll(async () => {
    if (db) {
      await testApp?.destroy();
      await db.destroy();
    }
    if (storageDir.length > 0) {
      await rm(storageDir, { recursive: true, force: true });
    }
  });

  it('checksums and stages an activity before queueing it', async () => {
    const buffer = Buffer.from('not really a fit file, but parsing happens in a later job');
    const file = makeUploadedFile('ride.fit', buffer);

    const result = await sut.uploadActivity(file);

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

    await expect(sut.handleActivityUpload(data)).resolves.toBe('success');
    const stored = await uploadRepository.getByChecksum(crypto.xxHash(buffer));
    expect(stored).toBeDefined();
    expect(queue).toHaveBeenCalledTimes(1);
    const [item, options] = queue.mock.calls[0] as unknown as [unknown, { transaction?: unknown }];
    expect(item).toEqual({ name: JobName.ActivityParse, data: { id: stored!.id } });
    expect(options.transaction).toBeDefined();

    queue.mockClear();
    await expect(sut.handleActivityUpload(data)).resolves.toBe('skipped');
    expect(queue).not.toHaveBeenCalled();

    await expect(
      sut.handleActivityUpload({
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
      sut.handleActivityUpload({
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
      sut.handleActivityUpload({
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

    await expect(sut.uploadActivity(file)).rejects.toThrow('Only .fit, .tcx and .gpx files are accepted');
  });

  it('leaves a staged activity for cleanup when queueing its upload fails', async () => {
    const contents = Buffer.from('activity');
    queue.mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(sut.uploadActivity(makeUploadedFile('ride.fit', contents))).rejects.toThrow('queue unavailable');

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

    const first = await sut.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(first).toEqual({ byteSize: archive.length, queued: true, importId: expect.any(String) });
    expect(queue).toHaveBeenCalledTimes(1);
    const [item] = queue.mock.calls[0] as unknown as [
      { name: JobName; data: { originalName: string; storagePath: string; takeoutImportId: string } },
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
    await expect(sut.handleLagomTakeout(item.data)).resolves.toBe('success');
    expect(queue).toHaveBeenCalledTimes(3);
    const [fitJob] = queue.mock.calls[0] as unknown as [
      {
        name: JobName;
        data: { originalName: string; storagePath: string; checksum: string; takeoutImportId?: string };
      },
    ];
    const [gpxJob] = queue.mock.calls[1] as unknown as [
      {
        name: JobName;
        data: { originalName: string; storagePath: string; checksum: string; takeoutImportId?: string };
      },
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
        takeoutImportId: item.data.takeoutImportId,
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
        takeoutImportId: item.data.takeoutImportId,
      },
    });
    await expect(storageRepository.read(fitJob.data.storagePath)).resolves.toEqual(fit);
    await expect(storageRepository.read(gpxJob.data.storagePath)).resolves.toEqual(gpx);
    queue.mockClear();
    const second = await sut.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(second).toEqual({ byteSize: archive.length, queued: true, importId: expect.any(String) });
    expect(queue).toHaveBeenCalledTimes(1);
  });

  it('defers validation of ZIP contents to the takeout import job', async () => {
    const archive = Buffer.from('nope');
    const result = await sut.uploadLagomTakeout(makeUploadedFile('export.zip', archive));

    expect(result.queued).toBe(true);
    const [item] = queue.mock.calls[0] as unknown as [{ data: { originalName: string; storagePath: string } }];
    await expect(sut.handleLagomTakeout(item.data)).rejects.toThrow();
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(archive);
    expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);
  });

  it('leaves a staged takeout for cleanup when queueing its import fails', async () => {
    const archive = Buffer.from('archive');
    queue.mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(sut.uploadLagomTakeout(makeUploadedFile('export.zip', archive))).rejects.toThrow('queue unavailable');

    const [item] = queue.mock.calls[0] as unknown as [{ data: { storagePath: string } }];
    await expect(storageRepository.read(item.data.storagePath)).resolves.toEqual(archive);
  });

  it('rejects a non-ZIP Strava takeout upload', async () => {
    await expect(sut.uploadLagomTakeout(makeUploadedFile('activities.csv', Buffer.from('nope')))).rejects.toThrow(
      'Only a Strava takeout .zip file is accepted',
    );
  });

  describe('real queue processing', () => {
    it.each(Object.values(activityFixtures))('parses $filename through the real queue', async (fixture) => {
      const contents = await readFile(fixture.path);
      const result = await queuedSut.uploadActivity(makeUploadedFile(fixture.filename, contents));
      expect(result.queued).toBe(true);

      await jobsRepository.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      const upload = await queuedUploadRepository.getByChecksum(crypto.xxHash(contents));
      expect(upload?.status).toBe('parsed');

      const activity = await activityRepository.getByUploadId(upload!.id);
      expect(activity).toBeDefined();
      expect(activity?.sport).toBe(fixture.expectedSport);
    });

    it('imports a Strava takeout and parses its activities through the real queues', async () => {
      const fit = await readFile(activityFixtures.hindasRun.path);
      const archive = createTestZip({
        'activities.csv': Buffer.from(
          'Activity ID,Activity Name,Activity Description,Activity Type,Filename\n1,Forest walk,A walk in the woods,Roller Ski,activities/run.fit.gz',
        ),
        'activities/run.fit.gz': gzipSync(fit),
      });

      const result = await queuedSut.uploadLagomTakeout(makeUploadedFile('export.zip', archive));
      expect(result.queued).toBe(true);
      expect(await queuedUploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);

      await jobsRepository.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      const imported = await queuedUploadRepository.getByChecksum(crypto.xxHash(fit));
      expect(imported?.status).toBe('parsed');
      expect(await activityRepository.getByUploadId(imported!.id)).toMatchObject({
        name: 'Forest walk',
        description: 'A walk in the woods',
        sport: 'roller_ski',
      });

      const updatedArchive = createTestZip({
        'activities.csv': Buffer.from(
          'Activity ID,Activity Name,Activity Description,Activity Type,Filename\n1,Updated hike,Updated description,Hike,activities/run.fit.gz',
        ),
        'activities/run.fit.gz': gzipSync(fit),
      });
      const updatedResult = await queuedSut.uploadLagomTakeout(makeUploadedFile('updated-export.zip', updatedArchive));
      await jobsRepository.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      expect(queuedSut.getLagomTakeoutStatus(updatedResult.importId, '')).toMatchObject({
        total: 1,
        processed: 1,
        duplicates: 1,
        status: 'completed',
      });
      expect(await activityRepository.getByUploadId(imported!.id)).toMatchObject({
        name: 'Forest walk',
        description: 'A walk in the woods',
        sport: 'roller_ski',
      });

      const iceSkateArchive = createTestZip({
        'activities.csv': Buffer.from(
          'Activity ID,Activity Name,Activity Description,Activity Type,Filename\n1,Evening skate,Frozen lake,Ice Skate,activities/run.fit.gz',
        ),
        'activities/run.fit.gz': gzipSync(fit),
      });
      const iceSkateResult = await queuedSut.uploadLagomTakeout(
        makeUploadedFile('ice-skate-export.zip', iceSkateArchive),
      );
      await jobsRepository.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      expect(queuedSut.getLagomTakeoutStatus(iceSkateResult.importId, '')).toMatchObject({
        total: 1,
        processed: 1,
        duplicates: 1,
        status: 'completed',
      });
      expect(await activityRepository.getByUploadId(imported!.id)).toMatchObject({
        name: 'Forest walk',
        description: 'A walk in the woods',
        sport: 'roller_ski',
      });
    });

    it('deduplicates manual activities using the takeout Activity ID', async () => {
      const archive = createTestZip({
        'activities.csv': Buffer.from(
          [
            'Activity ID,Activity Date,Activity Name,Activity Type,Filename,Elapsed Time,Moving Time,Distance,Distance',
            'manual-1,"Aug 10, 2016, 5:00:00 PM",Gym,Weight Training,,600,600,0,0',
          ].join('\n'),
        ),
      });

      const first = await queuedSut.uploadLagomTakeout(makeUploadedFile('manual.zip', archive));
      await jobsRepository.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);
      const second = await queuedSut.uploadLagomTakeout(makeUploadedFile('manual-again.zip', archive));
      await jobsRepository.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      expect(queuedSut.getLagomTakeoutStatus(first.importId, '')).toMatchObject({
        total: 1,
        processed: 1,
        duplicates: 0,
        status: 'completed',
      });
      expect(queuedSut.getLagomTakeoutStatus(second.importId, '')).toMatchObject({
        total: 1,
        processed: 1,
        duplicates: 1,
        status: 'completed',
      });

      const manualUpload = await queuedUploadRepository.getByChecksum('strava:manual-1');
      expect(manualUpload).toBeDefined();
      expect(await activityRepository.getByUploadId(manualUpload!.id)).toBeDefined();
    });
  });
});
