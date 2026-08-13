import { resolve } from 'node:path';
import { Client } from 'pg';
import { GenericContainer, Wait } from 'testcontainers';

import { migrateDatabase } from 'src/repositories/database.repository';

import { TEST_DB_URL_ENV, toDatabaseConfig } from 'test/medium/test-db';

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

  // Exercise the same PostGIS + VectorChord image used by development and production.
  const postgresImage = await GenericContainer.fromDockerfile(
    resolve(import.meta.dirname, '../../../packages/postgres'),
  )
    .withBuildArgs({ PG_MAJOR: '18', VECTORCHORD_TAG: '1.1.1' })
    .build('kondis-medium-postgres:latest', { deleteOnExit: false });
  const postgresContainer = await postgresImage
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
  await migrateDatabase(toDatabaseConfig(postgresUrl));

  return async () => {
    await postgresContainer.stop();
  };
};

export default globalSetup;
