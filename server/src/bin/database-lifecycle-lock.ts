import { spawn } from 'node:child_process';

import pg from 'pg';

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
};

const operationTasks = {
  migrate: [['//server:migrate']],
  'demo-reset': [['//server:demo-database', 'reset'], ['//server:demo-seed'], ['//server:demo-database', 'grant']],
  'demo-drop': [['//server:demo-database', 'drop']],
} as const;

type Operation = keyof typeof operationTasks;

const operation = required('KONDIS_DB_LIFECYCLE_OPERATION');
if (!(operation in operationTasks)) {
  throw new Error(`Unsupported database lifecycle operation: ${operation}`);
}

const runTask = async (argumentsList: readonly string[], connectionError: () => Error | undefined): Promise<void> => {
  const existingConnectionError = connectionError();
  if (existingConnectionError) {
    throw existingConnectionError;
  }

  const child = spawn('mise', ['run', ...argumentsList], { stdio: 'inherit' });
  await new Promise<void>((resolve, reject) => {
    const failOnConnectionError = setInterval(() => {
      const error = connectionError();
      if (!error) {
        return;
      }
      clearInterval(failOnConnectionError);
      child.kill('SIGTERM');
      reject(error);
    }, 250);
    child.once('error', (error) => {
      clearInterval(failOnConnectionError);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearInterval(failOnConnectionError);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`mise run ${argumentsList.join(' ')} failed with ${signal ?? `exit code ${code}`}`));
      }
    });
  });
};

const main = async (): Promise<void> => {
  const client = new pg.Client({
    host: process.env.KONDIS_DB_HOSTNAME ?? '127.0.0.1',
    port: Number(process.env.KONDIS_DB_PORT ?? '15432'),
    database: 'postgres',
    user: required('KONDIS_DB_MIGRATOR_USERNAME'),
    password: required('KONDIS_DB_MIGRATOR_PASSWORD'),
  });
  await client.connect();
  let connectionError: Error | undefined;
  client.on('error', (error) => {
    connectionError = error;
  });
  try {
    await client.query(`SELECT pg_advisory_lock(hashtext('kondis-database-lifecycle'))`);
    console.log('Acquired PostgreSQL lifecycle lock');
    for (const task of operationTasks[operation as Operation]) {
      await runTask(task, () => connectionError);
    }
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  console.error('[database-lifecycle-lock] failed:', error);
  process.exitCode = 1;
});
