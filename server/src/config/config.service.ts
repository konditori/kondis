import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';

import { QueueName, WorkerType } from 'src/enum';

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export type JobsConfig = {
  schema: string;
  concurrency: Record<QueueName, number>;
  retryLimit: number;
  retryDelaySeconds: number;
  expireInSeconds: number;
  deleteAfterSeconds: number;
  cron: boolean;
};

const DEFAULT_CONCURRENCY: Record<QueueName, number> = {
  [QueueName.ActivityParsing]: 2,
  [QueueName.BackgroundTask]: 2,
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
    return [WorkerType.API, WorkerType.JOBS];
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

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  readonly port: number;
  readonly workers: WorkerType[];
  readonly storageDir: string;
  readonly autoMigrate: boolean;
  readonly database: DatabaseConfig;
  readonly jobs: JobsConfig;
  /** Secret used to sign access tokens. Set KONDIS_AUTH_SECRET in production. */
  readonly authSecret: string;
  /** Secret required to claim a fresh installation. */
  readonly setupToken: string;
  /** Public account creation is opt-in for self-hosted installations. */
  readonly registrationEnabled: boolean;

  constructor() {
    this.port = Number(process.env.PORT ?? process.env.KONDIS_PORT ?? 2293);
    this.workers = parseWorkers(process.env.KONDIS_WORKERS);
    this.storageDir = process.env.KONDIS_STORAGE_DIR ?? '/data';
    this.autoMigrate = readBoolean('KONDIS_DB_AUTO_MIGRATE', true);
    // DB_PASSWORD keeps existing single-container installs usable, but a distinct
    // long random secret is recommended so database credentials can be rotated.
    this.authSecret = readSecret('KONDIS_AUTH_SECRET') ?? readSecret('DB_PASSWORD') ?? 'kondis-development-secret';
    this.setupToken = readSecret('KONDIS_SETUP_TOKEN') ?? this.authSecret;
    this.registrationEnabled = readBoolean('KONDIS_REGISTRATION_ENABLED', false);

    this.database = {
      host: readSecret('DB_HOSTNAME') ?? 'localhost',
      port: Number(readSecret('DB_PORT') ?? 5432),
      user: required('DB_USERNAME'),
      password: required('DB_PASSWORD'),
      database: required('DB_DATABASE_NAME'),
    };

    this.jobs = {
      schema: process.env.KONDIS_JOB_SCHEMA ?? 'kondis_jobs',
      concurrency: parseConcurrency(),
      retryLimit: readPositiveInteger('KONDIS_JOB_RETRY_LIMIT', 3),
      retryDelaySeconds: readPositiveInteger('KONDIS_JOB_RETRY_DELAY_SECONDS', 5),
      expireInSeconds: readPositiveInteger('KONDIS_JOB_EXPIRE_SECONDS', 900),
      deleteAfterSeconds: readPositiveInteger('KONDIS_JOB_RETENTION_SECONDS', 7 * 24 * 60 * 60),
      cron: readBoolean('KONDIS_JOB_CRON', true),
    };
  }

  hasWorker(worker: WorkerType): boolean {
    return this.workers.includes(worker);
  }

  logStartupSummary(): void {
    this.logger.log(`workers=${this.workers.join(',')} port=${this.port} storage=${this.storageDir}`);
    this.logger.log(`database=${this.database.host}:${this.database.port}/${this.database.database}`);

    if (this.hasWorker(WorkerType.JOBS)) {
      const concurrency = Object.entries(this.jobs.concurrency)
        .map(([queue, value]) => `${queue}=${value}`)
        .join(' ');
      this.logger.log(`jobs schema=${this.jobs.schema} cron=${this.jobs.cron} concurrency: ${concurrency}`);
    }
  }
}
