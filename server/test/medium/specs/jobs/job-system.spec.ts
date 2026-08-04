import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type KondisDatabase } from 'src/db/database';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName } from 'src/enum';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { ActivityService } from 'src/services/activity.service';
import { JobService } from 'src/services/job.service';
import { UploadService } from 'src/services/upload.service';
import { type JobItem, type UploadedFitFile } from 'src/types';

import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, truncateAllTables, truncateJobs } from 'test/medium/test-db';

const hasMediumDb = Boolean(process.env.KONDIS_TEST_POSTGRES_URL);

const fixtureSegments = ['test', 'test-assets', 'activities', 'running', '2015-hindas', '2015-06-22-run.fit'];
const fixtureCandidates = [
  resolve(process.cwd(), '..', ...fixtureSegments),
  resolve(process.cwd(), ...fixtureSegments),
];
const fixturePath = fixtureCandidates.find((path) => existsSync(path)) ?? fixtureCandidates[0];

const MISSING_UUID = 'ba5eba11-0000-4000-a000-000000000000';

describe.skipIf(!hasMediumDb)('job system (medium)', () => {
  let testApp: TestApp;
  let db: KondisDatabase;
  let fileBuffer: Buffer;

  let jobs: JobRepository;
  let jobService: JobService;
  let uploads: UploadService;
  let activities: ActivityService;
  let uploadRepository: UploadRepository;
  let activityRepository: ActivityRepository;
  let databaseRepository: DatabaseRepository;

  const asFile = (name: string, buffer: Buffer): UploadedFitFile =>
    ({ originalname: name, buffer, size: buffer.length }) as UploadedFitFile;

  beforeAll(async () => {
    fileBuffer = await readFile(fixturePath);
    db = createMediumTestDatabase();
    testApp = await createTestApp();

    jobs = testApp.get(JobRepository);
    jobService = testApp.get(JobService);
    uploads = testApp.get(UploadService);
    activities = testApp.get(ActivityService);
    uploadRepository = testApp.get(UploadRepository);
    activityRepository = testApp.get(ActivityRepository);
    databaseRepository = testApp.get(DatabaseRepository);
  }, 60_000);

  beforeEach(async () => {
    await truncateJobs(db);
    await truncateAllTables(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  describe('handler discovery', () => {
    const samples: Record<JobName, JobItem> = {
      [JobName.ActivityParse]: { name: JobName.ActivityParse, data: { id: MISSING_UUID } },
      [JobName.ActivityParseQueueAll]: { name: JobName.ActivityParseQueueAll, data: { force: false } },
      [JobName.ActivityDelete]: { name: JobName.ActivityDelete, data: { id: MISSING_UUID } },
      [JobName.FileDelete]: { name: JobName.FileDelete, data: { paths: [] } },
    };

    it('binds a handler to every job name', async () => {
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
    it('parses an uploaded file through the real queue', async () => {
      const result = await uploads.uploadFit(asFile('2015-06-22-run.fit', fileBuffer));
      expect(result.duplicate).toBe(false);

      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

      const activity = await activityRepository.getByUploadId(result.id);
      expect(activity).toBeDefined();
      expect(activity?.sport).toBeTruthy();

      const upload = await uploadRepository.getById(result.id);
      expect(upload?.status).toBe('parsed');
    }, 30_000);

    it('deletes the activity, the upload and the file', async () => {
      const { id: uploadId } = await uploads.uploadFit(asFile('2015-06-22-run.fit', fileBuffer));
      await jobs.waitForQueueCompletion(QueueName.ActivityParsing);

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
    }, 30_000);
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
