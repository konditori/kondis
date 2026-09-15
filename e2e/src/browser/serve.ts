// Own only this run's containers, processes, and temporary storage.
import { execFile, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '../../..');
const project = `kondis-browser-${process.pid}`;
const composeArguments = ['compose', '-p', project, '-f', resolve(root, 'e2e/browser.compose.yml')];
const storage = await mkdtemp(join(tmpdir(), 'kondis-browser-'));
await mkdir(resolve(root, 'e2e/browser-artifacts'), { recursive: true });
const log = createWriteStream(resolve(root, 'e2e/browser-artifacts/servers.log'));
const children: ReturnType<typeof spawn>[] = [];
const lifecycle = { stopping: false };

async function shutdown() {
  if (lifecycle.stopping) {
    return;
  }
  lifecycle.stopping = true;
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      const exited = new Promise<void>((done) => child.once('exit', () => done()));
      child.kill('SIGTERM');
      const timeout = setTimeout(() => child.kill('SIGKILL'), 36_000);
      await exited;
      clearTimeout(timeout);
    }),
  );
  try {
    const { stdout } = await exec('docker', [...composeArguments, 'logs', '--no-color']);
    log.write(stdout);
  } finally {
    await exec('docker', [...composeArguments, 'down', '--volumes', '--remove-orphans']);
    await rm(storage, { recursive: true, force: true });
    log.end();
  }
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown();
  });
}

function start(entry: string, environment: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, [entry], {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  child.once('exit', (code) => {
    if (lifecycle.stopping) {
      return;
    }

    console.error(`${entry} exited unexpectedly (${code}); see browser-artifacts/servers.log`);
    process.exitCode = 1;
    void shutdown();
  });
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('No test API port allocated');
  }
  await new Promise<void>((done, reject) => server.close((error) => (error ? reject(error) : done())));
  return address.port;
}

async function waitFor(url: string) {
  const deadline = Date.now() + 90_000;
  while (!lifecycle.stopping && Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        return;
      }
    } catch {
      /*
      Startup is still in progress.
      */
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}; see browser-artifacts/servers.log`);
}

try {
  console.log('Starting isolated browser test database…');
  const { stdout, stderr } = await exec(
    'docker',
    [...composeArguments, 'up', '-d', '--wait', process.env.KONDIS_E2E_POSTGRES_IMAGE ? '--no-build' : '--build'],
    { maxBuffer: 16 * 1024 * 1024 },
  );
  log.write(stdout + stderr);
  const binding = await exec('docker', [...composeArguments, 'port', 'database', '5432']);
  const port = binding.stdout.trim().split(':').at(-1)!;
  const apiPort = await freePort();
  const api = `http://127.0.0.1:${apiPort}`;
  const setupToken = 'browser-setup-token-0000000000000000';
  start('server/dist/bin/start.js', {
    KONDIS_SETUP_TOKEN: setupToken,
    KONDIS_DB_HOSTNAME: '127.0.0.1',
    KONDIS_DB_PORT: port,
    KONDIS_DB_USERNAME: 'postgres',
    KONDIS_DB_PASSWORD: 'postgres',
    KONDIS_DB_DATABASE_NAME: 'kondis_browser',
    KONDIS_PORT: String(apiPort),
    KONDIS_STORAGE_DIR: storage,
  });
  await waitFor(`${api}/api/v1/ping`);
  const verify = await fetch(`${api}/api/v1/auth/setup/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ setupToken }),
  });
  if (!verify.ok) {
    throw new Error(`Setup verification failed: ${await verify.text()}`);
  }
  const { token } = (await verify.json()) as { token: string };
  const setup = await fetch(`${api}/api/v1/auth/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      setupTicket: token,
      email: 'browser@example.com',
      password: 'browser-test-password',
      firstName: 'Browser',
      lastName: 'Test',
    }),
  });
  if (!setup.ok) {
    throw new Error(`Account setup failed: ${await setup.text()}`);
  }
  start('web/build/index.js', {
    KONDIS_API_URL: api,
    HOST: '127.0.0.1',
    PORT: '2396',
    ORIGIN: 'http://127.0.0.1:2396',
    BODY_SIZE_LIMIT: '70M',
    PUBLIC_KONDIS_EVENTS_URL: `ws://localhost:${apiPort}/events`,
  });
  console.log('Browser test API and frontend started.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  await shutdown();
}
