import { ConsoleLogger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type ConfigService } from 'src/config/config.service';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName, WorkerType } from 'src/enum';
import { type JobRepository } from 'src/repositories/job.repository';
import { JobService } from 'src/services/job.service';
import { JobItem } from 'src/types';
import { newTestService } from 'test/utils';

const makeConfig = (workers: WorkerType[]): ConfigService =>
  ({ workers, hasWorker: (worker: WorkerType) => workers.includes(worker) }) as ConfigService;

describe('JobService', () => {
  const run = vi.fn<(item: JobItem) => Promise<JobStatus>>();
  const queue = vi.fn(async () => {});
  const startWorkers = vi.fn<(onJobRun: (item: JobItem) => Promise<void>) => Promise<void>>(() => Promise.resolve());
  const getJobCounts = vi.fn(() =>
    Promise.resolve({ active: 0, queued: 0, deferred: 0, ready: 0, failed: 0, total: 0 }),
  );
  const isPaused = vi.fn(() => false);
  const pause = vi.fn(async () => {});
  const resume = vi.fn(async () => {});
  const empty = vi.fn(async () => {});
  const clearFailed = vi.fn(async () => {});

  const jobRepository = {
    run,
    queue,
    startWorkers,
    getJobCounts,
    isPaused,
    pause,
    resume,
    empty,
    clearFailed,
  } as unknown as JobRepository;

  const setup = (workers = [WorkerType.API, WorkerType.JOBS]) =>
    newTestService(JobService, [makeConfig(workers), jobRepository, new ConsoleLogger({ logLevels: [] })], {
      jobRepository,
    });

  const makeService = (workers = [WorkerType.API, WorkerType.JOBS]) => setup(workers).sut;

  const captureRunner = async (): Promise<(item: JobItem) => Promise<void>> => {
    await makeService().init();
    return startWorkers.mock.calls.at(-1)![0];
  };

  beforeEach(() => {
    vi.clearAllMocks();
    run.mockResolvedValue(JobStatus.Success);
    isPaused.mockReturnValue(false);
  });

  describe('init', () => {
    it('consumes when the jobs role is enabled', async () => {
      await makeService().init();
      expect(startWorkers).toHaveBeenCalledTimes(1);
    });

    it('stays a pure producer when it is not', async () => {
      await makeService([WorkerType.API]).init();
      expect(startWorkers).not.toHaveBeenCalled();
    });
  });

  describe('running a job', () => {
    it('rethrows an unexpected error so the queue can retry it', async () => {
      const runner = await captureRunner();
      run.mockRejectedValue(new Error('connection reset'));

      // Swallowing here would mark the job complete and lose the work silently.
      await expect(runner({ name: JobName.FileDelete, data: { paths: [] } })).rejects.toThrow('connection reset');
    });

    it('does not rethrow when a handler reports an expected failure', async () => {
      const runner = await captureRunner();
      run.mockResolvedValue(JobStatus.Failed);

      // JobStatus.Failed means "retrying cannot help", so the job is settled rather than retried.
      await expect(runner({ name: JobName.FileDelete, data: { paths: [] } })).resolves.toBeUndefined();
    });

    it('passes the job straight through to the repository', async () => {
      const runner = await captureRunner();
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
      expect(getJobCounts).toHaveBeenCalledTimes(Object.values(QueueName).length);
    });
  });
});
