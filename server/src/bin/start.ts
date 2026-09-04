import { fork, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { WorkerType } from 'src/enum';
import { ConfigRepository } from 'src/repositories/config.repository';

const apiEntry = resolve(import.meta.dirname, '..', 'workers', 'api.js');
const workerEntry = resolve(import.meta.dirname, '..', 'workers', 'worker.js');
type Runtime = ChildProcess | Worker;

const children = new Map<Runtime, WorkerType>();
const SHUTDOWN_TIMEOUT_MS = 35_000;
let stopping = false;

const startRole = (role: WorkerType, environment: NodeJS.ProcessEnv = {}): Runtime => {
  console.log(`Starting ${role}`);
  const env = { ...process.env, ...environment };
  const child: Runtime =
    role === WorkerType.API
      ? fork(apiEntry, [], { env, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] })
      : new Worker(workerEntry, { env });

  children.set(child, role);
  child.once('exit', () => children.delete(child));
  return child;
};

export const stopRuntime = (child: Runtime, role: WorkerType, signal: NodeJS.Signals): void => {
  if (role === WorkerType.API) {
    (child as ChildProcess).kill(signal);
  } else {
    (child as Worker).postMessage({ type: 'shutdown' });
  }

  const timeout = setTimeout(() => {
    if (role === WorkerType.API) {
      (child as ChildProcess).kill('SIGKILL');
    } else {
      void (child as Worker).terminate();
    }
  }, SHUTDOWN_TIMEOUT_MS);
  timeout.unref();
  child.once('exit', () => clearTimeout(timeout));
};

const stopChildren = (signal: NodeJS.Signals = 'SIGTERM'): void => {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const [child, role] of children) {
    stopRuntime(child, role, signal);
  }
};

const exitResult = async (child: Runtime): Promise<number> => {
  const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];
  if (!stopping) {
    console.error(`Kondis runtime exited (${code ?? signal ?? 'unknown'})`);
    stopChildren();
  }
  return code ?? (signal ? 1 : 0);
};

const waitForApi = async (api: ChildProcess): Promise<void> => {
  const config = new ConfigRepository();
  const port = config.port;
  const address = config.listenAddress;
  const host = address === '0.0.0.0' ? '127.0.0.1' : address;
  const url = `http://${host}:${port}/api/v1/ping`;

  while (!stopping && api.exitCode === null && api.signalCode === null) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        return;
      }
    } catch {
      // The API is still migrating or starting.
    }
    await delay(250);
  }

  throw new Error('API exited before becoming ready');
};

const run = async (): Promise<void> => {
  process.once('SIGINT', () => stopChildren('SIGINT'));
  process.once('SIGTERM', () => stopChildren('SIGTERM'));

  const api = startRole(WorkerType.API) as ChildProcess;
  const apiExit = exitResult(api);
  await waitForApi(api);

  const worker = startRole(WorkerType.WORKER);
  const workerExit = exitResult(worker);
  process.exitCode = await Promise.race([apiExit, workerExit]);
  await Promise.allSettled([apiExit, workerExit]);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch((error: unknown) => {
    console.error(error);
    stopChildren();
    process.exitCode = 1;
  });
}
