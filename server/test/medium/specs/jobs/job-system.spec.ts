import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type KondisDatabase } from 'src/db/database';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName } from 'src/enum';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { UploadService } from 'src/services/upload.service';
import { type JobItem } from 'src/types';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { activityFixtures, makeUploadedFile } from 'test/medium/utils';
import { createTestZip } from 'test/utils/zip';

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';
const SAMPLE_GPX = Buffer.from('<gpx/>');

describe('job system (medium)', () => {
  let testApp: TestApp;
  let db: KondisDatabase;

  let jobs: JobRepository;
  let jobService: JobService;
  let uploads: UploadService;
  let activities: ActivityService;
  let uploadRepository: UploadRepository;
  let activityRepository: ActivityRepository;
  let databaseRepository: DatabaseRepository;
  let storageRepository: StorageRepository;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();

    jobs = testApp.get(JobRepository);
    jobService = testApp.get(JobService);
    uploads = testApp.get(UploadService);
    activities = testApp.get(ActivityService);
    uploadRepository = testApp.get(UploadRepository);
    activityRepository = testApp.get(ActivityRepository);
    databaseRepository = testApp.get(DatabaseRepository);
    storageRepository = testApp.get(StorageRepository);
  }, 60_000);

  beforeEach(async () => {
    await resetMediumTestDatabase(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  describe('handler discovery', () => {
    const samples: Record<JobName, JobItem> = {
      [JobName.ActivityUpload]: {
        name: JobName.ActivityUpload,
        data: {
          originalName: 'sample.gpx',
          storagePath: 'temporary/sample.gpx',
          checksum: new CryptoRepository().xxHash(SAMPLE_GPX),
        },
      },
      [JobName.ActivityParse]: { name: JobName.ActivityParse, data: { id: MISSING_UUID } },
      [JobName.ActivityParseQueueAll]: { name: JobName.ActivityParseQueueAll, data: { force: false } },
      [JobName.ActivityDelete]: { name: JobName.ActivityDelete, data: { id: MISSING_UUID } },
      [JobName.LagomTakeoutImport]: {
        name: JobName.LagomTakeoutImport,
        data: {
          originalName: 'empty.zip',
          storagePath: 'temporary/empty.zip',
        },
      },
      [JobName.FileDelete]: { name: JobName.FileDelete, data: { paths: [] } },
      [JobName.TemporaryFileCleanup]: { name: JobName.TemporaryFileCleanup, data: {} },
    };

    it('binds a handler to every job name', async () => {
      await storageRepository.write('temporary/sample.gpx', SAMPLE_GPX);
      await storageRepository.write(
        'temporary/empty.zip',
        createTestZip({ 'activities.csv': Buffer.from('Activity ID,Filename\n') }),
      );

      for (const item of Object.values(samples)) {
        await expect(jobs.run(item)).resolves.toSatisfy((status) =>
          Object.values(JobStatus).includes(status as JobStatus),
        );
      }
    });

    it('routes every job name to a queue', async () => {
      // Pausing first keeps the assertion about routing rather than about execution speed.
      await Promise.all(Object.values(QueueName).map((queue) => jobs.pause(queue)));

      try {
        await jobs.queueAll(Object.values(samples));

        const counts = await Promise.all(Object.values(QueueName).map((queue) => jobs.getJobCounts(queue)));
        const queued = counts.reduce((sum, { queued: value }) => sum + value, 0);

        expect(queued).toBe(Object.values(JobName).length);
      } finally {
        await Promise.all(Object.values(QueueName).map((queue) => jobs.resume(queue)));
      }
    });
  });

  describe('end to end', () => {
    it.each(Object.values(activityFixtures))('parses $filename through the real queue', async (fixture) => {
      const contents = await readFile(fixture.path);
      const result = await uploads.uploadActivity(makeUploadedFile(fixture.filename, contents));
      expect(result.queued).toBe(true);

      await jobs.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      const upload = await uploadRepository.getByChecksum(new CryptoRepository().xxHash(contents));
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

      const result = await uploads.uploadLagomTakeout(makeUploadedFile('export.zip', archive));
      expect(result.queued).toBe(true);
      expect(await uploadRepository.getIdsToParse({ force: true, limit: 100 })).toEqual([]);

      await jobs.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      const imported = await uploadRepository.getByChecksum(new CryptoRepository().xxHash(fit));
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
      await uploads.uploadLagomTakeout(makeUploadedFile('updated-export.zip', updatedArchive));
      await jobs.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      expect(await activityRepository.getByUploadId(imported!.id)).toMatchObject({
        name: 'Updated hike',
        description: 'Updated description',
        sport: 'hike',
      });

      const iceSkateArchive = createTestZip({
        'activities.csv': Buffer.from(
          'Activity ID,Activity Name,Activity Description,Activity Type,Filename\n1,Evening skate,Frozen lake,Ice Skate,activities/run.fit.gz',
        ),
        'activities/run.fit.gz': gzipSync(fit),
      });
      await uploads.uploadLagomTakeout(makeUploadedFile('ice-skate-export.zip', iceSkateArchive));
      await jobs.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      expect(await activityRepository.getByUploadId(imported!.id)).toMatchObject({
        name: 'Evening skate',
        description: 'Frozen lake',
        sport: 'ice_skate',
      });
    });

    it('deletes the activity, the upload and the file', async () => {
      const fixture = activityFixtures.hindasRun;
      const contents = await readFile(fixture.path);
      await uploads.uploadActivity(makeUploadedFile(fixture.filename, contents));
      await jobs.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.ActivityParsing);

      const uploaded = await uploadRepository.getByChecksum(new CryptoRepository().xxHash(contents));
      const uploadId = uploaded!.id;

      const activity = await activityRepository.getByUploadId(uploadId);
      expect(activity).toBeDefined();

      const upload = await uploadRepository.getById(uploadId);
      const storedFile = resolve(testApp.storageDir, upload!.storage_path);
      expect(existsSync(storedFile)).toBe(true);

      await jobs.queue({ name: JobName.ActivityDelete, data: { id: activity!.id } });
      // The file delete is a follow-up job enqueued inside the delete transaction, so both
      // queues have to settle before the filesystem reflects the change.
      await jobs.waitForQueueCompletion(QueueName.BackgroundTask, QueueName.Storage);

      expect(await uploadRepository.getById(uploadId)).toBeUndefined();
      expect(await activityRepository.getById(activity!.id)).toBeUndefined();
      expect(existsSync(storedFile)).toBe(false);
    });
  });

  describe('transactional enqueue', () => {
    it('discards the job when the transaction rolls back', async () => {
      await expect(
        databaseRepository.withTransaction(async (trx) => {
          await jobs.queue(
            { name: JobName.FileDelete, data: { paths: ['does/not/matter.fit'] } },
            { transaction: trx },
          );
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');

      // Nothing was committed, so there is nothing for a worker to have picked up. Anything
      // other than zero here would mean the enqueue escaped the transaction.
      const counts = await jobs.getJobCounts(QueueName.Storage);
      expect(counts.total).toBe(0);
    });

    it('commits the job with the row it belongs to', async () => {
      const before = await jobs.getJobCounts(QueueName.Storage);

      await databaseRepository.withTransaction(async (trx) => {
        await jobs.queue({ name: JobName.FileDelete, data: { paths: [] } }, { transaction: trx });
      });

      await jobs.waitForQueueCompletion(QueueName.Storage);

      const after = await jobs.getJobCounts(QueueName.Storage);
      expect(after.total).toBe(before.total + 1);
    }, 20_000);
  });

  describe('temporary file references', () => {
    it('reports paths held by pending jobs so cleanup can preserve them', async () => {
      await jobs.pause(QueueName.BackgroundTask);

      try {
        await jobs.queueAll([
          {
            name: JobName.ActivityUpload,
            data: {
              originalName: 'run.fit',
              storagePath: 'temporary/run.fit',
              checksum: 'a'.repeat(32),
            },
          },
          {
            name: JobName.LagomTakeoutImport,
            data: { originalName: 'takeout.zip', storagePath: 'temporary/takeout.zip' },
          },
        ]);

        await expect(jobs.getReferencedTemporaryPaths()).resolves.toEqual(
          new Set(['temporary/run.fit', 'temporary/takeout.zip']),
        );
      } finally {
        await jobs.empty(QueueName.BackgroundTask);
        await jobs.resume(QueueName.BackgroundTask);
      }
    });
  });

  describe('deduplication', () => {
    it('does not queue a second parse while one is pending', async () => {
      await jobs.pause(QueueName.ActivityParsing);

      try {
        const upload = await uploadRepository.create({
          checksum: 'deadbeef'.repeat(4),
          original_name: 'x.fit',
          byte_size: 1,
          storage_path: 'de/ad/deadbeef.fit',
        });

        const item = { name: JobName.ActivityParse, data: { id: upload.id } } as const;
        await jobs.queue(item);
        await jobs.queue(item);
        await jobs.queue(item);

        const counts = await jobs.getJobCounts(QueueName.ActivityParsing);
        expect(counts.queued).toBe(1);
      } finally {
        await jobs.resume(QueueName.ActivityParsing);
      }
    });
  });

  describe('fan-out', () => {
    it('drains an existing backlog without waiting for another notification', async () => {
      await jobs.pause(QueueName.Storage);

      try {
        await jobs.queueAll(
          Array.from({ length: 26 }, () => ({
            name: JobName.FileDelete,
            data: { paths: [] },
          })),
        );

        const counts = await jobs.getJobCounts(QueueName.Storage);
        expect(counts.queued).toBe(26);
        await jobs.resume(QueueName.Storage);

        await Promise.race([
          jobs.waitForQueueCompletion(QueueName.Storage),
          delay(5000).then(() => {
            throw new Error('Storage queue did not drain its existing backlog within 5 seconds');
          }),
        ]);
      } finally {
        await jobs.empty(QueueName.Storage);
        await jobs.resume(QueueName.Storage);
      }
    });

    it('queues a parse for every upload that never produced an activity', async () => {
      await jobs.pause(QueueName.ActivityParsing);

      try {
        for (let index = 0; index < 3; index++) {
          await uploadRepository.create({
            checksum: String(index).repeat(32),
            original_name: `${index}.fit`,
            byte_size: 1,
            storage_path: `${index}/${index}.fit`,
          });
        }

        const status = await activities.handleActivityParseQueueAll({ force: false });
        expect(status).toBe(JobStatus.Success);

        const counts = await jobs.getJobCounts(QueueName.ActivityParsing);
        expect(counts.queued).toBe(3);
      } finally {
        await jobs.resume(QueueName.ActivityParsing);
      }
    });
  });

  describe('administration', () => {
    it('reports counts for every queue', async () => {
      const status = await jobService.getAllJobStatus();

      expect(Object.keys(status).sort()).toEqual(Object.values(QueueName).sort());
      for (const queue of Object.values(QueueName)) {
        expect(status[queue].jobCounts.active).toBe(0);
        expect(status[queue].queueStatus.paused).toBe(false);
      }
    });

    it('pauses, empties and resumes a queue', async () => {
      const paused = await jobService.handleCommand(QueueName.ActivityParsing, QueueCommand.Pause);
      expect(paused.queueStatus.paused).toBe(true);

      const upload = await uploadRepository.create({
        checksum: 'a'.repeat(32),
        original_name: 'a.fit',
        byte_size: 1,
        storage_path: 'a/a.fit',
      });
      await jobs.queue({ name: JobName.ActivityParse, data: { id: upload.id } });

      const queued = await jobService.handleCommand(QueueName.ActivityParsing, QueueCommand.Empty);
      expect(queued.jobCounts.queued).toBe(0);

      const resumed = await jobService.handleCommand(QueueName.ActivityParsing, QueueCommand.Resume);
      expect(resumed.queueStatus.paused).toBe(false);
    });

    it('runs a manual job', async () => {
      await jobService.create(ManualJobName.ReparseFailedUploads);
      await jobs.waitForQueueCompletion(QueueName.BackgroundTask);

      const counts = await jobs.getJobCounts(QueueName.BackgroundTask);
      expect(counts.total).toBeGreaterThan(0);
      expect(counts.failed).toBe(0);
    }, 20_000);
  });
});
