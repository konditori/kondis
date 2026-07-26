import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WorkerType } from 'src/types';

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

/**
 * Reads `NAME` or, if `NAME_FILE` points at a non-empty file, the trimmed contents of
 * that file. This mirrors `packages/postgres/set-env.sh` so the server honours the same
 * Docker-secret convention the database container already supports.
 */
const readSecret = (name: string): string | undefined => {
  const filePath = process.env[`${name}_FILE`];
  if (filePath) {
    try {
      const contents = readFileSync(filePath, 'utf8').trim();
      if (contents.length > 0) {
        return contents;
      }
    } catch {
      // Fall through to the plain env var below.
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

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);

  readonly port: number;
  readonly workers: WorkerType[];
  readonly storageDir: string;
  readonly autoMigrate: boolean;
  readonly database: DatabaseConfig;

  constructor() {
    this.port = Number(process.env.PORT ?? process.env.KONDIS_PORT ?? 2293);
    this.workers = parseWorkers(process.env.KONDIS_WORKERS);
    this.storageDir = process.env.KONDIS_STORAGE_DIR ?? resolve(process.cwd(), 'uploads');
    // Self-hosted installs should not have to run a migration step by hand. Opt out by
    // setting KONDIS_DB_AUTO_MIGRATE=false if migrations are managed externally.
    this.autoMigrate = (process.env.KONDIS_DB_AUTO_MIGRATE ?? 'true').toLowerCase() !== 'false';

    this.database = {
      host: readSecret('DB_HOSTNAME') ?? 'localhost',
      port: Number(readSecret('DB_PORT') ?? 5432),
      user: required('DB_USERNAME'),
      password: required('DB_PASSWORD'),
      database: required('DB_DATABASE_NAME'),
    };
  }

  hasWorker(worker: WorkerType): boolean {
    return this.workers.includes(worker);
  }

  logStartupSummary(): void {
    this.logger.log(`workers=${this.workers.join(',')} port=${this.port} storage=${this.storageDir}`);
    this.logger.log(`database=${this.database.host}:${this.database.port}/${this.database.database}`);
  }
}
