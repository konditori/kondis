import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ConfigService, concurrencyEnvVar } from 'src/config/config.service';
import { QueueName, WorkerType } from 'src/enum';

describe('ConfigService', () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    original = process.env;
    process.env = {
      DB_USERNAME: 'kondis',
      DB_PASSWORD: 'kondis',
      DB_DATABASE_NAME: 'kondis',
    };
  });

  afterEach(() => {
    process.env = original;
  });

  describe('workers', () => {
    it('runs every role when unset, which is what a single-container install wants', () => {
      expect(new ConfigService().workers).toEqual([WorkerType.API, WorkerType.JOBS]);
    });

    it('narrows to the requested roles', () => {
      process.env.KONDIS_WORKERS = 'jobs';

      const config = new ConfigService();
      expect(config.hasWorker(WorkerType.JOBS)).toBe(true);
      expect(config.hasWorker(WorkerType.API)).toBe(false);
    });

    it('refuses to start on a typo rather than silently running nothing', () => {
      process.env.KONDIS_WORKERS = 'jbos';
      expect(() => new ConfigService()).toThrow(/Unknown KONDIS_WORKERS/);
    });
  });

  describe('job concurrency', () => {
    it('derives the environment variable name from the queue name', () => {
      expect(concurrencyEnvVar(QueueName.ActivityParsing)).toBe('KONDIS_JOB_CONCURRENCY_ACTIVITY_PARSING');
      expect(concurrencyEnvVar(QueueName.BackgroundTask)).toBe('KONDIS_JOB_CONCURRENCY_BACKGROUND_TASK');
      expect(concurrencyEnvVar(QueueName.Storage)).toBe('KONDIS_JOB_CONCURRENCY_STORAGE');
    });

    it('gives every queue a default', () => {
      const { concurrency } = new ConfigService().jobs;

      for (const queue of Object.values(QueueName)) {
        expect(concurrency[queue]).toBeGreaterThan(0);
      }
    });

    it('applies a global override to every queue', () => {
      process.env.KONDIS_JOB_CONCURRENCY = '7';

      const { concurrency } = new ConfigService().jobs;
      expect(Object.values(concurrency)).toEqual([7, 7, 7]);
    });

    it('lets a per-queue override win over the global one', () => {
      process.env.KONDIS_JOB_CONCURRENCY = '7';
      process.env[concurrencyEnvVar(QueueName.ActivityParsing)] = '2';

      const { concurrency } = new ConfigService().jobs;
      expect(concurrency[QueueName.ActivityParsing]).toBe(2);
      expect(concurrency[QueueName.Storage]).toBe(7);
    });

    it('rejects a value that is not a positive integer', () => {
      process.env[concurrencyEnvVar(QueueName.Storage)] = 'lots';
      expect(() => new ConfigService()).toThrow(/must be a positive integer/);
    });
  });

  describe('job defaults', () => {
    it('keeps pg-boss out of the public schema', () => {
      expect(new ConfigService().jobs.schema).toBe('kondis_jobs');
    });

    it('retries a few times before giving up', () => {
      expect(new ConfigService().jobs.retryLimit).toBeGreaterThan(0);
    });

    it('can turn the scheduler off', () => {
      expect(new ConfigService().jobs.cron).toBe(true);

      process.env.KONDIS_JOB_CRON = 'false';
      expect(new ConfigService().jobs.cron).toBe(false);
    });
  });
});
