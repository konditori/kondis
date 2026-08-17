import { sql } from 'kysely';
import { type DatabaseConfig } from 'src/config/config.service';
import { createDatabase, type KondisDatabase } from 'src/db/database';

export const TEST_DB_URL_ENV = 'KONDIS_TEST_POSTGRES_URL';

export const TEST_JOB_SCHEMA = 'kondis_jobs_test';

const getRequired = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const toDatabaseConfig = (url: string): DatabaseConfig => {
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

export const getTestDatabaseConfig = (): DatabaseConfig => toDatabaseConfig(getRequired(TEST_DB_URL_ENV));

export const createMediumTestDatabase = (): KondisDatabase => createDatabase(getTestDatabaseConfig());

export const truncateAllTables = async (db: KondisDatabase): Promise<void> => {
  await sql`
    TRUNCATE TABLE live_workout_point, live_workout, activity_route_match, activity_stream, activity_best_effort, activity_metric, lap, activity, upload
    RESTART IDENTITY CASCADE
  `.execute(db);
};

export const truncateJobs = async (db: KondisDatabase): Promise<void> => {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = ${TEST_JOB_SCHEMA} AND table_name = 'job'
    ) AS exists
  `.execute(db);

  if (rows[0]?.exists) {
    await sql`DELETE FROM ${sql.ref(`${TEST_JOB_SCHEMA}.job`)}`.execute(db);
  }
};

export const resetMediumTestDatabase = async (db: KondisDatabase): Promise<void> => {
  await truncateJobs(db);
  await truncateAllTables(db);
};
