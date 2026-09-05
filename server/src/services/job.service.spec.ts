import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName } from 'src/enum';
import { ConsoleLogger } from 'src/logger';
import type { JobAdminPort, JobConsumerPort, JobProducerPort } from 'src/ports/queue.port';
import { type EventRepository } from 'src/repositories/event.repository';
import { JobService } from 'src/services/job.service';
import { JobItem } from 'src/types/jobs';
import { newTestService } from 'test/utils';

describe('JobService', () => {
  const run = vi.fn<(item: JobItem) => Promise<JobStatus>>();
  const queue = vi.fn(async () => {});
  const startWorkers = vi.fn<(onJobRun: (item: JobItem) => Promise<JobStatus>) => Promise<void>>(() =>
    Promise.resolve(),
  );
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
    run,
    queue,
    startWorkers,
    getJobCounts,
    getAllJobCounts,
    isPaused,
    pause,
    resume,
    empty,
    clearFailed,
    getJobHistory,
  } as unknown as JobProducerPort & JobAdminPort & JobConsumerPort;
  const queues = { admin: jobRepository, consumer: jobRepository, producer: jobRepository };

  const setup = () =>
    newTestService(JobService, [queues, { emit } as unknown as EventRepository, new ConsoleLogger({ logLevels: [] })], {
      jobRepository,
      queues,
    });

  const makeService = () => setup().sut;

  const captureRunner = (): ((item: JobItem) => Promise<JobStatus>) => {
    const service = makeService() as unknown as {
      onJobRun: (item: JobItem) => Promise<JobStatus>;
    };
    return service.onJobRun.bind(service);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    run.mockResolvedValue(JobStatus.Success);
    isPaused.mockReturnValue(false);
  });

  describe('init', () => {
    it('does not consume jobs in the API process', async () => {
      await makeService().init(false);
      expect(startWorkers).not.toHaveBeenCalled();
    });

    it('starts workers when job consumption is enabled', async () => {
      await makeService().init(true);
      expect(startWorkers).toHaveBeenCalledOnce();
    });
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

    it('passes the job straight through to the repository', async () => {
      const runner = captureRunner();
      const item: JobItem = { name: JobName.ActivityParse, data: { id: 'abc' } };

      await runner(item);

      expect(run).toHaveBeenCalledWith(item);
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
