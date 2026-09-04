import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { CloudflareQueueAdapter } from 'src/adapters/cloudflare/queue.adapter';
import { JobName, QueueName } from 'src/enum';
import { HttpStatus, UnsupportedOperationError } from 'src/errors';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const upload = (storagePath = 'temporary/activity.gpx'): JobItem => ({
  name: JobName.ActivityUpload,
  data: { originalName: 'activity.gpx', storagePath },
});

describe(CloudflareQueueAdapter.name, () => {
  let db: KondisDatabase;
  let jobs: CloudflareQueueAdapter;

  beforeAll(() => {
    db = createMediumTestDatabase();
    jobs = new CloudflareQueueAdapter(db);
  });

  beforeEach(() => resetMediumTestDatabase(db));

  afterAll(async () => {
    await db?.destroy();
  });

  it('rolls back a transactional enqueue', async () => {
    await expect(
      db.transaction().execute(async (transaction) => {
        await jobs.queue(upload(), { transaction });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({ queued: 0, total: 0 });
  });

  it('deduplicates singleton jobs and exposes history and temporary references', async () => {
    await jobs.queueAll([upload(), upload()]);

    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({ queued: 1, ready: 1, total: 1 });
    await expect(jobs.getReferencedTemporaryPaths()).resolves.toEqual(new Set(['temporary/activity.gpx']));
    await expect(jobs.getJobHistory(10)).resolves.toMatchObject({ total: 1, jobs: [{ status: 'queued' }] });

    await jobs.discardQueuedDuplicates(JobName.ActivityUpload);
    await expect(jobs.getJobCounts(QueueName.BackgroundTask)).resolves.toMatchObject({ queued: 0, total: 0 });
  });

  it('reports unsupported queue administration explicitly', async () => {
    await expect(jobs.pause(QueueName.BackgroundTask)).rejects.toBeInstanceOf(UnsupportedOperationError);
    await expect(jobs.empty(QueueName.BackgroundTask)).rejects.toSatisfy(
      (error) => error instanceof UnsupportedOperationError && error.getStatus() === HttpStatus.NOT_IMPLEMENTED,
    );
  });
});
