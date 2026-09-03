import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearEnvCache, ConfigRepository, concurrencyEnvVar } from 'src/repositories/config.repository';
import { QueueName, WorkerType } from 'src/enum';

describe('ConfigRepository', () => {
  let original: NodeJS.ProcessEnv;

  beforeEach(() => {
    clearEnvCache();
    original = process.env;
    process.env = {
      KONDIS_DB_USERNAME: 'kondis',
      KONDIS_DB_PASSWORD: 'kondis',
      KONDIS_DB_DATABASE_NAME: 'kondis',
    };
  });

  afterEach(() => {
    clearEnvCache();
    process.env = original;
  });

  describe('workers', () => {
    it('runs only the API role when unset so jobs cannot block its event loop', () => {
      expect(new ConfigRepository().getEnv().workers).toEqual([WorkerType.API]);
    });

    it('narrows to the requested roles', () => {
      process.env.KONDIS_WORKERS = 'worker';

      const config = new ConfigRepository();
      expect(config.hasWorker(WorkerType.WORKER)).toBe(true);
      expect(config.hasWorker(WorkerType.API)).toBe(false);
    });

    it('refuses to start on a typo rather than silently running nothing', () => {
      process.env.KONDIS_WORKERS = 'jbos';
      expect(() => new ConfigRepository().getEnv()).toThrow(/Unknown KONDIS_WORKERS/);
    });

    it('requires API and jobs to run in separate processes', () => {
      process.env.KONDIS_WORKERS = 'api,worker';
      expect(() => new ConfigRepository().getEnv()).toThrow(/separate processes/);
    });
  });

  describe('setup token', () => {
    it('generates and caches a UUID instead of requiring an operator-provided token', () => {
      const first = new ConfigRepository().getEnv().setupToken;
      const second = new ConfigRepository().getEnv().setupToken;

      expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(second).toBe(first);
    });

    it('caches the parsed environment', () => {
      const repository = new ConfigRepository();
      expect(repository.getEnv()).toBe(repository.getEnv());
    });
  });

  describe('job concurrency', () => {
    it('derives the environment variable name from the queue name', () => {
      expect(concurrencyEnvVar(QueueName.ActivityParsing)).toBe('KONDIS_JOB_CONCURRENCY_ACTIVITY_PARSING');
      expect(concurrencyEnvVar(QueueName.BackgroundTask)).toBe('KONDIS_JOB_CONCURRENCY_BACKGROUND_TASK');
      expect(concurrencyEnvVar(QueueName.Storage)).toBe('KONDIS_JOB_CONCURRENCY_STORAGE');
    });

    it('gives every queue a default', () => {
      const { concurrency } = new ConfigRepository().getEnv().jobs;

      for (const queue of Object.values(QueueName)) {
        expect(concurrency[queue]).toBeGreaterThan(0);
      }
      expect(concurrency[QueueName.ActivityParsing]).toBe(1);
      expect(concurrency[QueueName.BackgroundTask]).toBe(1);
    });

    it('applies a global override to every queue', () => {
      process.env.KONDIS_JOB_CONCURRENCY = '7';

      const { concurrency } = new ConfigRepository().getEnv().jobs;
      expect(Object.values(concurrency)).toEqual([7, 7, 7, 7]);
    });

    it('lets a per-queue override win over the global one', () => {
      process.env.KONDIS_JOB_CONCURRENCY = '7';
      process.env[concurrencyEnvVar(QueueName.ActivityParsing)] = '2';

      const { concurrency } = new ConfigRepository().getEnv().jobs;
      expect(concurrency[QueueName.ActivityParsing]).toBe(2);
      expect(concurrency[QueueName.Storage]).toBe(7);
    });

    it('rejects a value that is not a positive integer', () => {
      process.env[concurrencyEnvVar(QueueName.Storage)] = 'lots';
      expect(() => new ConfigRepository().getEnv()).toThrow(/must be a positive integer/);
    });
  });

  describe('job defaults', () => {
    it('keeps pg-boss out of the public schema', () => {
      expect(new ConfigRepository().getEnv().jobs.schema).toBe('kondis_jobs');
    });

    it('retries a few times before giving up', () => {
      expect(new ConfigRepository().getEnv().jobs.retryLimit).toBeGreaterThan(0);
    });

    it('can turn the scheduler off', () => {
      expect(new ConfigRepository().getEnv().jobs.cron).toBe(true);

      process.env.KONDIS_JOB_CRON = 'false';
      clearEnvCache();
      expect(new ConfigRepository().getEnv().jobs.cron).toBe(false);
    });
  });

  describe('database defaults', () => {
    it('uses the Docker Compose database service when the hostname is unset', () => {
      expect(new ConfigRepository().getEnv().database.host).toBe('database');
    });
  });
});
