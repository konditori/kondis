import { Client } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';

import { type DatabaseConfig } from 'src/config/config.service';
import { runMigrations } from 'src/db/migrate';

const TEST_DB_URL_ENV = 'KONDIS_TEST_POSTGRES_URL';

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

const ensureExtensions = async (url: string): Promise<void> => {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
  } finally {
    await client.end();
  }
};

const globalSetup = async (): Promise<() => Promise<void>> => {
  const databaseName = 'kondis_medium';
  const username = 'postgres';
  const password = 'postgres';

  const postgresContainer = await new GenericContainer('postgis/postgis:18')
    .withExposedPorts(5432)
    .withEnvironment({
      POSTGRES_PASSWORD: password,
      POSTGRES_USER: username,
      POSTGRES_DB: databaseName,
    })
    .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
    .start();

  const postgresPort = postgresContainer.getMappedPort(5432);
  const postgresUrl = `postgres://${username}:${password}@127.0.0.1:${postgresPort}/${databaseName}`;

  process.env[TEST_DB_URL_ENV] = postgresUrl;

  await ensureExtensions(postgresUrl);
  await runMigrations(toDatabaseConfig(postgresUrl));

  return async () => {
    await postgresContainer.stop();
  };
};

export default globalSetup;
