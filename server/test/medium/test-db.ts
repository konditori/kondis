import { sql } from 'kysely';
import { type DatabaseConfig } from 'src/config/config.service';
import { createDatabase, type KondisDatabase } from 'src/db/database';

const TEST_DB_URL_ENV = 'KONDIS_TEST_POSTGRES_URL';

const getRequired = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const toDatabaseConfig = (url: string): DatabaseConfig => {
  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, '');

  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
};

export const createMediumTestDatabase = (): KondisDatabase => {
  const url = getRequired(TEST_DB_URL_ENV);
  return createDatabase(toDatabaseConfig(url));
};

export const truncateAllTables = async (db: KondisDatabase): Promise<void> => {
  await sql`TRUNCATE TABLE activity_stream, lap, activity, upload RESTART IDENTITY CASCADE`.execute(db);
};
