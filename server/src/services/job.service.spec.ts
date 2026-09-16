import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JobRepository } from 'src/contracts/job.repository';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName } from 'src/enum';
import { ConsoleLogger } from 'src/logger';
import { type PostgresRealtimeRepository } from 'src/repositories/node/postgres-realtime.repository';
import { JobService } from 'src/services/job.service';
import { JobItem } from 'src/types/jobs';
import { newTestService } from 'test/utils';

describe('JobService', () => {
  const run = vi.fn<() => Promise<JobStatus>>();
  const queue = vi.fn(async () => {});
  const getJobCounts = vi.fn(() =>
    Promise.resolve({ active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 }),
  );
  const getAllJobCounts = vi.fn(() =>
    Promise.resolve(
      Object.fromEntries(
        Object.values(QueueName).map((queue) => [
          queue,
          { active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 },
        ]),
      ) as Record<QueueName, Awaited<ReturnType<typeof getJobCounts>>>,
    ),
  );
  const isPaused = vi.fn(() => false);
  const pause = vi.fn(async () => {});
  const resume = vi.fn(async () => {});
  const empty = vi.fn(async () => {});
  const clearFailed = vi.fn(async () => {});
  const getJobHistory = vi.fn(() => Promise.resolve({ jobs: [], total: 0 }));
  const emit = vi.fn(async () => {});

  const jobRepository = {
    queue,
    getJobCounts,
    getAllJobCounts,
    isPaused,
    pause,
    resume,
    empty,
    clearFailed,
    getJobHistory,
  } as unknown as JobRepository;

  const setup = () =>
    newTestService(
      JobService,
      [
        jobRepository,
        { emit } as unknown as PostgresRealtimeRepository,
        new ConsoleLogger({ logLevels: [] }),
        {
          [JobName.FileDelete]: run,
          [JobName.ActivityParse]: run,
        },
      ],
      {
        jobRepository,
      },
    );

  const makeService = () => setup().sut;

  const captureRunner = (): ((item: JobItem) => Promise<JobStatus>) => {
    const service = makeService();
    return service.execute.bind(service);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    run.mockResolvedValue(JobStatus.Success);
    isPaused.mockReturnValue(false);
  });

  describe('running a job', () => {
    it('rethrows an unexpected error so the queue can retry it', async () => {
      const runner = captureRunner();
      run.mockRejectedValue(new Error('connection reset'));

      // Swallowing here would mark the job complete and lose the work silently.
      await expect(runner({ name: JobName.FileDelete, data: { paths: [] } })).rejects.toThrow('connection reset');
    });

    it('does not rethrow when a handler reports an expected failure', async () => {
      const runner = captureRunner();
      run.mockResolvedValue(JobStatus.Failed);

      // JobStatus.Failed means "retrying cannot help", so the job is settled rather than retried.
      await expect(runner({ name: JobName.FileDelete, data: { paths: [] } })).resolves.toBe(JobStatus.Failed);
    });

    it('executes the registered domain handler with the job data', async () => {
      const runner = captureRunner();
      const item: JobItem = { name: JobName.ActivityParse, data: { id: 'abc' } };

      await runner(item);

      expect(run).toHaveBeenCalledWith(item.data);
    });

    it('rejects an unregistered job', async () => {
      await expect(makeService().execute({ name: JobName.AuthCredentialCleanup, data: {} })).rejects.toThrow(
        'No handler registered for job AuthCredentialCleanup',
      );
    });

    it('lets the batch boundary report updates once for Queue deliveries', async () => {
      await makeService().execute({ name: JobName.FileDelete, data: { paths: [] } }, { notify: false });
      expect(run).toHaveBeenCalledOnce();
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('manual jobs', () => {
    it.each([
      [ManualJobName.ReparseFailedUploads, false],
      [ManualJobName.ReparseAllUploads, true],
    ])('maps %s to a fan-out with force=%s', async (name, force) => {
      await makeService().create(name);

      expect(queue).toHaveBeenCalledWith({ name: JobName.ActivityParseQueueAll, data: { force } });
    });
  });

  describe('queue commands', () => {
    it.each([
      [QueueCommand.Pause, pause],
      [QueueCommand.Resume, resume],
      [QueueCommand.Empty, empty],
      [QueueCommand.ClearFailed, clearFailed],
    ])('%s reaches the repository', async (command, expected) => {
      await makeService().handleCommand(QueueName.Storage, command);

      expect(expected).toHaveBeenCalledWith(QueueName.Storage);
    });

    it('answers with the state after the command, not before it', async () => {
      isPaused.mockReturnValue(true);

      const report = await makeService().handleCommand(QueueName.Storage, QueueCommand.Pause);

      expect(report.queueStatus.paused).toBe(true);
      expect(report.jobCounts.total).toBe(0);
    });

    it('rejects a command it does not recognise', async () => {
      await expect(makeService().handleCommand(QueueName.Storage, 'detonate' as QueueCommand)).rejects.toThrow(
        /Invalid queue command/,
      );
    });
  });

  describe('status', () => {
    it('reports on every queue', async () => {
      const status = await makeService().getAllJobStatus();

      expect(Object.keys(status).sort()).toEqual(Object.values(QueueName).sort());
      expect(getAllJobCounts).toHaveBeenCalledOnce();
      expect(getJobCounts).not.toHaveBeenCalled();
    });

    it('returns recent job history with the requested limit', async () => {
      await expect(makeService().getJobHistory(25)).resolves.toEqual({ jobs: [], total: 0 });
      expect(getJobHistory).toHaveBeenCalledWith(25, 0);
    });
  });
});
