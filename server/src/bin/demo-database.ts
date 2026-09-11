import pg from 'pg';

import { runtimeRoleForDemoDatabase } from 'src/demo/database-lifecycle';

const usage = 'Usage: demo-database <reset | grant | drop>';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
};

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const databaseName = required('KONDIS_DB_DATABASE_NAME');
const runtimeUsername = required('KONDIS_DB_RUNTIME_USERNAME');
const migratorUsername = required('KONDIS_DB_MIGRATOR_USERNAME');

const expectedRuntimeUsername = runtimeRoleForDemoDatabase(databaseName);
if (runtimeUsername !== expectedRuntimeUsername) {
  throw new Error(`Runtime role ${runtimeUsername} does not belong to database ${databaseName}`);
}

const connection = {
  host: process.env.KONDIS_DB_HOSTNAME ?? '127.0.0.1',
  port: Number(process.env.KONDIS_DB_PORT ?? '15432'),
  user: migratorUsername,
  password: required('KONDIS_DB_MIGRATOR_PASSWORD'),
};

const withClient = async <T>(database: string, operation: (client: pg.Client) => Promise<T>): Promise<T> => {
  const client = new pg.Client({ ...connection, database });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
};

const roleStatement = async (client: pg.Client, action: 'create' | 'alter', password: string): Promise<string> => {
  const keyword = action === 'create' ? 'CREATE' : 'ALTER';
  const result = await client.query<{ statement: string }>(
    `SELECT format('${keyword} ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', $1, $2) AS statement`,
    [runtimeUsername, password],
  );
  return result.rows[0].statement;
};

const ensureRuntimeRole = async (client: pg.Client): Promise<void> => {
  const password = required('KONDIS_DB_RUNTIME_PASSWORD');
  const result = await client.query<{ exists: boolean }>('SELECT EXISTS (SELECT FROM pg_roles WHERE rolname = $1)', [
    runtimeUsername,
  ]);
  await client.query(await roleStatement(client, result.rows[0].exists ? 'alter' : 'create', password));
};

const grantRuntimeAccess = async (): Promise<void> => {
  const database = quoteIdentifier(databaseName);
  const runtimeRole = quoteIdentifier(runtimeUsername);
  const migratorRole = quoteIdentifier(migratorUsername);

  await withClient(databaseName, async (client) => {
    await client.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
    await client.query(`REVOKE CONNECT, TEMPORARY ON DATABASE ${database} FROM PUBLIC`);
    await client.query(`GRANT CONNECT ON DATABASE ${database} TO ${runtimeRole}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${runtimeRole}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`);
    await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole}`);
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorRole} IN SCHEMA public ` +
        `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole}`,
    );
    await client.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${migratorRole} IN SCHEMA public ` +
        `GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${runtimeRole}`,
    );
  });
};

const resetDatabase = async (): Promise<void> => {
  const database = quoteIdentifier(databaseName);
  const migratorRole = quoteIdentifier(migratorUsername);

  await withClient('postgres', async (client) => {
    await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [`kondis-demo-database:${databaseName}`]);
    await ensureRuntimeRole(client);
    await client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    await client.query(`CREATE DATABASE ${database} OWNER ${migratorRole}`);
  });
  await grantRuntimeAccess();
  console.log(`Recreated demo database ${databaseName}`);
};

const dropDatabase = async (): Promise<void> => {
  const database = quoteIdentifier(databaseName);
  const runtimeRole = quoteIdentifier(runtimeUsername);

  await withClient('postgres', async (client) => {
    await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [`kondis-demo-database:${databaseName}`]);
    await client.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`);
    if (databaseName.startsWith('kondis-demo-pr-')) {
      await client.query(`DROP ROLE IF EXISTS ${runtimeRole}`);
    }
  });
  console.log(`Dropped demo database ${databaseName}`);
};

const main = async (): Promise<void> => {
  switch (process.argv[2]) {
    case 'reset': {
      await resetDatabase();
      break;
    }
    case 'grant': {
      await grantRuntimeAccess();
      break;
    }
    case 'drop': {
      await dropDatabase();
      break;
    }
    default: {
      throw new Error(usage);
    }
  }
};

void main().catch((error: unknown) => {
  console.error('[demo-database] failed:', error);
  process.exitCode = 1;
});
