import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

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
import { type JobItem } from 'src/types/jobs';

import { createMediumFactory, makeUploadedFile } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';
import { activityFixtures } from 'test/medium/utils';
import { createTestZip } from 'test/utils/zip';

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';
const SAMPLE_GPX = Buffer.from('<gpx/>');

describe('JobRepository', () => {
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
  let ownerId: string;

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
    await resetMediumTestDatabase(db, jobs);
    const owner = await createMediumFactory(db).newUser();
    ownerId = owner.id;
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  describe('handler discovery', () => {
    // This fixture builder is scoped with the related tests for readability.
    // eslint-disable-next-line unicorn/consistent-function-scoping
    const buildSamples = (ownerId: string): Record<JobName, JobItem> => ({
      [JobName.ActivityUpload]: {
        name: JobName.ActivityUpload,
        data: {
          userId: ownerId,
          originalName: 'sample.gpx',
          storagePath: 'temporary/sample.gpx',
          checksum: new CryptoRepository().xxHash(SAMPLE_GPX),
        },
      },
      [JobName.ActivityMetricCompute]: {
        name: JobName.ActivityMetricCompute,
        data: { id: MISSING_UUID },
      },
      [JobName.ActivityBestEffortCompute]: {
        name: JobName.ActivityBestEffortCompute,
        data: { id: MISSING_UUID },
      },
      [JobName.ActivityBestEffortRank]: { name: JobName.ActivityBestEffortRank, data: {} },
      [JobName.ActivityRouteMatchCompute]: {
        name: JobName.ActivityRouteMatchCompute,
        data: { id: MISSING_UUID },
      },
      [JobName.ActivityParse]: { name: JobName.ActivityParse, data: { id: MISSING_UUID } },
      [JobName.ActivityParseQueueAll]: { name: JobName.ActivityParseQueueAll, data: { force: false } },
      [JobName.ActivityDelete]: { name: JobName.ActivityDelete, data: { id: MISSING_UUID } },
      [JobName.ActivityImageIngest]: {
        name: JobName.ActivityImageIngest,
        data: {
          imageId: MISSING_UUID,
          uploadId: MISSING_UUID,
          storagePath: 'temporary/missing.jpg',
          originalName: 'missing.jpg',
          checksum: 'missing',
        },
      },
      [JobName.ActivityImageAttach]: {
        name: JobName.ActivityImageAttach,
        data: { uploadId: MISSING_UUID, images: [] },
      },
      [JobName.ActivityImageGenerateThumbnails]: {
        name: JobName.ActivityImageGenerateThumbnails,
        data: { id: MISSING_UUID },
      },
      [JobName.ActivityImageGenerateQueueAll]: { name: JobName.ActivityImageGenerateQueueAll, data: { force: false } },
      [JobName.LagomTakeoutImport]: {
        name: JobName.LagomTakeoutImport,
        data: {
          userId: ownerId,
          originalName: 'empty.zip',
          storagePath: 'temporary/empty.zip',
        },
      },
      [JobName.UserAvatarUpload]: {
        name: JobName.UserAvatarUpload,
        data: { userId: MISSING_UUID, storagePath: 'temporary/missing.jpg' },
      },
      [JobName.FileDelete]: { name: JobName.FileDelete, data: { paths: [] } },
      [JobName.TemporaryFileCleanup]: { name: JobName.TemporaryFileCleanup, data: {} },
      [JobName.ActivityManualCreate]: {
        name: JobName.ActivityManualCreate,
        data: {
          id: MISSING_UUID,
          userId: ownerId,
          activitySport: 'run',
          startedAt: '2024-01-01T00:00:00.000Z',
          elapsedTime: 60,
        },
      },
    });

    it('binds a handler to every job name', async () => {
      await storageRepository.write('temporary/sample.gpx', SAMPLE_GPX);
      await storageRepository.write(
        'temporary/empty.zip',
        createTestZip({ 'activities.csv': Buffer.from('Activity ID,Filename\n') }),
      );

      for (const item of Object.values(buildSamples(ownerId))) {
        await expect(jobs.run(item)).resolves.toSatisfy((status) =>
          Object.values(JobStatus).includes(status as JobStatus),
        );
      }
    });

    it('routes every job name to a queue', async () => {
      // Pausing first keeps the assertion about routing rather than about execution speed.
      await Promise.all(Object.values(QueueName).map((queue) => jobs.pause(queue)));

      try {
        await Promise.all(Object.values(QueueName).map((queue) => jobs.empty(queue)));
        await jobs.queueAll(Object.values(buildSamples(ownerId)));

        const counts = await Promise.all(Object.values(QueueName).map((queue) => jobs.getJobCounts(queue)));
        const queued = counts.reduce((sum, { queued: value }) => sum + value, 0);

        expect(queued).toBe(Object.values(JobName).length);
      } finally {
        await Promise.all(Object.values(QueueName).map((queue) => jobs.empty(queue)));
        await Promise.all(Object.values(QueueName).map((queue) => jobs.resume(queue)));
      }
    });

    it('accepts every ranking refresh request and coalesces queued duplicates', async () => {
      await jobs.pause(QueueName.ActivityParsing);

      try {
        await jobs.empty(QueueName.ActivityParsing);
        await jobs.queueAll([
          { name: JobName.ActivityBestEffortRank, data: {} },
          { name: JobName.ActivityBestEffortRank, data: {} },
          { name: JobName.ActivityBestEffortRank, data: {} },
        ]);

        const initialCounts = await jobs.getJobCounts(QueueName.ActivityParsing);
        expect(initialCounts.queued).toBe(3);

        await jobs.discardQueuedDuplicates(JobName.ActivityBestEffortRank);
        const finalCounts = await jobs.getJobCounts(QueueName.ActivityParsing);
        expect(finalCounts.queued).toBe(0);
      } finally {
        await jobs.empty(QueueName.ActivityParsing);
        await jobs.resume(QueueName.ActivityParsing);
      }
    });

    it('runs one ranking refresh when a bulk operation queues more than one worker batch', async () => {
      await jobs.pause(QueueName.ActivityParsing);
      const refresh = vi.spyOn(activityRepository, 'refreshBestEffortRankings');

      try {
        await jobs.empty(QueueName.ActivityParsing);
        await jobs.queueAll(
          Array.from({ length: 50 }, () => ({
            name: JobName.ActivityBestEffortRank,
            data: {},
          })),
        );

        await jobs.resume(QueueName.ActivityParsing);
        await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

        expect(refresh).toHaveBeenCalledTimes(1);
      } finally {
        refresh.mockRestore();
        await jobs.empty(QueueName.ActivityParsing);
        await jobs.resume(QueueName.ActivityParsing);
      }
    });
  });

  describe('end to end', () => {
    it('deletes the activity, the upload and the file', async () => {
      const fixture = activityFixtures.hindasRun;
      const contents = await readFile(fixture.path);
      await uploads.uploadActivity(makeUploadedFile(fixture.filename, contents), ownerId);
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
    it('keeps disk-backed activity uploads with no checksum distinct', async () => {
      await jobs.pause(QueueName.BackgroundTask);

      try {
        await jobs.queueAll([
          {
            name: JobName.ActivityUpload,
            data: { originalName: 'one.fit', storagePath: 'temporary/one.fit' },
          },
          {
            name: JobName.ActivityUpload,
            data: { originalName: 'two.fit', storagePath: 'temporary/two.fit' },
          },
        ]);

        const counts = await jobs.getJobCounts(QueueName.BackgroundTask);
        expect(counts.queued).toBe(2);
      } finally {
        await jobs.empty(QueueName.BackgroundTask);
        await jobs.resume(QueueName.BackgroundTask);
      }
    });

    it('does not queue a second parse while one is pending', async () => {
      await jobs.pause(QueueName.ActivityParsing);

      try {
        const upload = await uploadRepository.create({
          checksum: 'deadbeef'.repeat(4),
          original_name: 'x.fit',
          byte_size: 1,
          storage_path: 'de/ad/deadbeef.fit',
          user_id: ownerId,
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
            user_id: ownerId,
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
        user_id: ownerId,
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
