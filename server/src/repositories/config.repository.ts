import { Logger } from 'src/logger';
import type { ConfigPort } from 'src/ports/config.port';
import type { DatabaseConfig, EnvData } from 'src/types';

export type ConfigEnvironment = Readonly<Record<string, string | undefined>>;

function readEnv(environment: ConfigEnvironment, name: string): string | undefined;
function readEnv(environment: ConfigEnvironment, name: string, fallback: string): string;
function readEnv(environment: ConfigEnvironment, name: string, fallback?: string): string | undefined {
  const value = environment[name];
  return value && value.length > 0 ? value : fallback;
}

const required = (environment: ConfigEnvironment, name: string): string => {
  const value = readEnv(environment, name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const readBoolean = (environment: ConfigEnvironment, name: string, fallback: boolean): boolean => {
  const value = readEnv(environment, name);
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

const readPositiveInteger = (environment: ConfigEnvironment, name: string, fallback: number): number => {
  const raw = readEnv(environment, name);
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer, got: ${raw}`);
  }

  return value;
};

const getEnv = (environment: ConfigEnvironment): EnvData => {
  const database: DatabaseConfig = {
    host: readEnv(environment, 'KONDIS_DB_HOSTNAME', 'database'),
    port: readPositiveInteger(environment, 'KONDIS_DB_PORT', 5432),
    user: required(environment, 'KONDIS_DB_USERNAME'),
    password: required(environment, 'KONDIS_DB_PASSWORD'),
    database: required(environment, 'KONDIS_DB_DATABASE_NAME'),
  };

  return {
    setupToken: readEnv(environment, 'KONDIS_SETUP_TOKEN'),
    trustProxyHeaders: readBoolean(environment, 'KONDIS_TRUST_PROXY_HEADERS', false),
    port: readPositiveInteger(environment, 'KONDIS_PORT', 2293),
    listenAddress: readEnv(environment, 'KONDIS_LISTEN_ADDRESS', '0.0.0.0'),
    storageDir: readEnv(environment, 'KONDIS_STORAGE_DIR', '/data'),
    registrationEnabled: readBoolean(environment, 'KONDIS_REGISTRATION_ENABLED', false),
    demoMode: readBoolean(environment, 'KONDIS_DEMO_MODE', false),
    database,
  };
};

export class ConfigRepository implements ConfigPort {
  private readonly logger = new Logger(ConfigRepository.name);
  private readonly environment: ConfigEnvironment;
  private envCache: EnvData | undefined;

  constructor(environment: ConfigEnvironment = process.env) {
    this.environment = { ...environment };
  }

  getEnv(): EnvData {
    this.envCache ??= getEnv(this.environment);
    return this.envCache;
  }

  get port(): number {
    return this.getEnv().port;
  }

  get setupToken(): string | undefined {
    return readEnv(this.environment, 'KONDIS_SETUP_TOKEN');
  }

  get trustProxyHeaders(): boolean {
    return readBoolean(this.environment, 'KONDIS_TRUST_PROXY_HEADERS', false);
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
    return readBoolean(this.environment, 'KONDIS_REGISTRATION_ENABLED', false);
  }

  get demoMode(): boolean {
    return readBoolean(this.environment, 'KONDIS_DEMO_MODE', false);
  }

  logStartupSummary(): void {
    const config = this.getEnv();
    this.logger.log(`port=${config.port} storage=${config.storageDir}`);
    this.logger.log(`database=${config.database.host}:${config.database.port}/${config.database.database}`);
  }
}
