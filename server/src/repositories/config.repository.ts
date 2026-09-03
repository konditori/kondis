import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { QueueName, WorkerType } from 'src/enum';
import type { DatabaseConfig, EnvData, JobsConfig } from 'src/types';

const DEFAULT_CONCURRENCY: Record<QueueName, number> = {
  [QueueName.ActivityParsing]: 1,
  [QueueName.BackgroundTask]: 1,
  [QueueName.ImageProcessing]: 2,
  [QueueName.Storage]: 2,
};

const readSecret = (name: string): string | undefined => {
  const filePath = process.env[`${name}_FILE`];
  if (filePath) {
    try {
      const contents = readFileSync(filePath, 'utf8').trim();
      if (contents.length > 0) {
        return contents;
      }
    } catch {
      // Fall through to the plain env var below
    }
  }

  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
};

const required = (name: string): string => {
  const value = readSecret(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name} (or ${name}_FILE)`);
  }
  return value;
};

const readBoolean = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    return fallback;
  }
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase());
};

const readPositiveInteger = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }

  return value;
};

const parseWorkers = (raw: string | undefined): WorkerType[] => {
  const known = new Set<string>(Object.values(WorkerType));
  if (!raw) {
    return [WorkerType.API];
  }

  const requested = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);

  const unknown = requested.filter((entry) => !known.has(entry));
  if (unknown.length > 0) {
    const valid = [...known].join(', ');
    throw new Error(`Unknown KONDIS_WORKERS value(s): ${unknown.join(', ')}. Valid values: ${valid}`);
  }

  if (requested.length === 0) {
    throw new Error('KONDIS_WORKERS was set but contained no valid worker names.');
  }
  if (requested.length > 1) {
    throw new Error(
      'The api and worker roles must run in separate processes. Set KONDIS_WORKERS to either api or worker.',
    );
  }

  return requested as WorkerType[];
};

export const concurrencyEnvVar = (queue: QueueName): string =>
  `KONDIS_JOB_CONCURRENCY_${queue.replaceAll(/([a-z\d])([A-Z])/g, '$1_$2').toUpperCase()}`;

const parseConcurrency = (): Record<QueueName, number> => {
  const fallback = readPositiveInteger('KONDIS_JOB_CONCURRENCY', 0);
  const entries = Object.values(QueueName).map((queue) => [
    queue,
    readPositiveInteger(concurrencyEnvVar(queue), fallback || DEFAULT_CONCURRENCY[queue]),
  ]);

  return Object.fromEntries(entries) as Record<QueueName, number>;
};

const getEnv = (): EnvData => {
  const database: DatabaseConfig = {
      host: readSecret('KONDIS_DB_HOSTNAME') ?? 'database',
      port: Number(readSecret('KONDIS_DB_PORT') ?? 5432),
      user: required('KONDIS_DB_USERNAME'),
      password: required('KONDIS_DB_PASSWORD'),
      database: required('KONDIS_DB_DATABASE_NAME'),
  };

  const jobs: JobsConfig = {
      schema: process.env.KONDIS_JOB_SCHEMA ?? 'kondis_jobs',
      concurrency: parseConcurrency(),
      retryLimit: readPositiveInteger('KONDIS_JOB_RETRY_LIMIT', 3),
      retryDelaySeconds: readPositiveInteger('KONDIS_JOB_RETRY_DELAY_SECONDS', 5),
      expireInSeconds: readPositiveInteger('KONDIS_JOB_EXPIRE_SECONDS', 900),
      deleteAfterSeconds: readPositiveInteger('KONDIS_JOB_RETENTION_SECONDS', 7 * 24 * 60 * 60),
      cron: readBoolean('KONDIS_JOB_CRON', true),
  };

  return {
    port: Number(process.env.KONDIS_PORT ?? 2293),
    workers: parseWorkers(process.env.KONDIS_WORKERS),
    storageDir: process.env.KONDIS_STORAGE_DIR ?? '/data',
    autoMigrate: readBoolean('KONDIS_DB_AUTO_MIGRATE', true),
    authSecret:
      readSecret('KONDIS_AUTH_SECRET') ?? readSecret('KONDIS_DB_PASSWORD') ?? 'kondis-development-secret',
    setupToken: readSecret('KONDIS_SETUP_TOKEN') ?? randomUUID(),
    registrationEnabled: readBoolean('KONDIS_REGISTRATION_ENABLED', false),
    database,
    jobs,
  };
};

let cached: EnvData | undefined;

export const clearEnvCache = (): void => {
  cached = undefined;
};

@Injectable()
export class ConfigRepository {
  private readonly logger = new Logger(ConfigRepository.name);

  getEnv(): EnvData {
    cached ??= getEnv();
    return cached;
  }

  get port(): number {
    return this.getEnv().port;
  }

  get workers(): WorkerType[] {
    return this.getEnv().workers;
  }

  get storageDir(): string {
    return this.getEnv().storageDir;
  }

  get autoMigrate(): boolean {
    return this.getEnv().autoMigrate;
  }

  get database(): DatabaseConfig {
    return this.getEnv().database;
  }

  get jobs(): JobsConfig {
    return this.getEnv().jobs;
  }

  get authSecret(): string {
    return this.getEnv().authSecret;
  }

  get setupToken(): string {
    return this.getEnv().setupToken;
  }

  get registrationEnabled(): boolean {
    return this.getEnv().registrationEnabled;
  }

  hasWorker(worker: WorkerType): boolean {
    return this.getEnv().workers.includes(worker);
  }

  logStartupSummary(): void {
    const config = this.getEnv();
    this.logger.log(`workers=${config.workers.join(',')} port=${config.port} storage=${config.storageDir}`);
    this.logger.log(`database=${config.database.host}:${config.database.port}/${config.database.database}`);

    if (this.hasWorker(WorkerType.WORKER)) {
      const concurrency = Object.entries(config.jobs.concurrency)
        .map(([queue, value]) => `${queue}=${value}`)
        .join(' ');
      this.logger.log(`jobs schema=${config.jobs.schema} cron=${config.jobs.cron} concurrency: ${concurrency}`);
    }
  }
}
