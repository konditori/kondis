import { Injectable, Logger } from '@nestjs/common';

import type { ConfigPort } from 'src/ports/config.port';
import type { DatabaseConfig, EnvData } from 'src/types';

function readEnv(name: string): string | undefined;
function readEnv(name: string, fallback: string): string;
function readEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const required = (name: string): string => {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const readBoolean = (name: string, fallback: boolean): boolean => {
  const value = readEnv(name);
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }

  throw new Error(`${name} must be true or false, got: ${value}`);
};

const readPositiveInteger = (name: string, fallback: number): number => {
  const raw = readEnv(name);
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }

  return value;
};

const getEnv = (): EnvData => {
  const database: DatabaseConfig = {
    host: readEnv('KONDIS_DB_HOSTNAME', 'database'),
    port: readPositiveInteger('KONDIS_DB_PORT', 5432),
    user: required('KONDIS_DB_USERNAME'),
    password: required('KONDIS_DB_PASSWORD'),
    database: required('KONDIS_DB_DATABASE_NAME'),
  };

  return {
    port: readPositiveInteger('KONDIS_PORT', 2293),
    listenAddress: readEnv('KONDIS_LISTEN_ADDRESS', '0.0.0.0'),
    storageDir: readEnv('KONDIS_STORAGE_DIR', '/data'),
    registrationEnabled: readBoolean('KONDIS_REGISTRATION_ENABLED', false),
    database,
  };
};

@Injectable()
export class ConfigRepository implements ConfigPort {
  private readonly logger = new Logger(ConfigRepository.name);
  private envCache: EnvData | undefined;

  getEnv(): EnvData {
    this.envCache ??= getEnv();
    return this.envCache;
  }

  get port(): number {
    return this.getEnv().port;
  }

  get listenAddress(): string {
    return this.getEnv().listenAddress;
  }

  get storageDir(): string {
    return this.getEnv().storageDir;
  }

  get database(): DatabaseConfig {
    return this.getEnv().database;
  }

  get registrationEnabled(): boolean {
    return this.getEnv().registrationEnabled;
  }

  logStartupSummary(): void {
    const config = this.getEnv();
    this.logger.log(`port=${config.port} storage=${config.storageDir}`);
    this.logger.log(`database=${config.database.host}:${config.database.port}/${config.database.database}`);
  }
}
