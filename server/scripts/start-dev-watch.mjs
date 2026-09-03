import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const buildCommands = [
  ['node', ['scripts/clean-dist.mjs']],
  ['node_modules/.bin/tsc', ['-p', 'tsconfig.build.json']],
  ['node_modules/.bin/tsc-alias', ['-p', 'tsconfig.build.json']],
];

let activeCommand;
let server;
let debounceTimer;
let pollTimer;
let building = false;
let rebuildPending = false;
let restarting = false;
let stopping = false;
let sourceState = '';

const waitForExit = (child) =>
  new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });

const run = async (command, args) => {
  activeCommand = spawn(command, args, { stdio: 'inherit' });
  const result = await waitForExit(activeCommand);
  activeCommand = undefined;
  return result;
};

const build = async () => {
  console.log('Building server');
  for (const [command, args] of buildCommands) {
    const { code, signal } = await run(command, args);
    if (code !== 0) {
      console.error(`Server build failed (${code ?? signal ?? 'unknown'}); waiting for changes`);
      return false;
    }
  }
  return true;
};

const stopServer = async () => {
  if (!server) return;
  const currentServer = server;
  server = undefined;
  if (currentServer.exitCode !== null || currentServer.signalCode !== null) return;
  const exit = waitForExit(currentServer);
  const killServer = (signal) => {
    try {
      process.kill(-currentServer.pid, signal);
    } catch {
      currentServer.kill(signal);
    }
  };
  killServer('SIGTERM');
  const forceKillTimer = setTimeout(() => killServer('SIGKILL'), 3_000);
  await exit;
  clearTimeout(forceKillTimer);
};

const startServer = () => {
  console.log('Starting server');
  server = spawn('node', ['dist/bin/start.js'], { detached: true, stdio: 'inherit' });
  server.once('error', (error) => {
    console.error('Failed to start server', error);
  });
  server.once('exit', (code, signal) => {
    if (!stopping && !restarting) {
      console.error(`Server exited (${code ?? signal ?? 'unknown'})`);
      void stop().then(() => process.exit(code ?? 1));
    }
  });
};

const sourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
    }),
  );
  return files.flat();
};

const readSourceState = async () => {
  const files = (await sourceFiles('src')).sort();
  const metadata = await Promise.all(
    files.map(async (path) => {
      const { mtimeMs, size } = await stat(path);
      return `${path}:${mtimeMs}:${size}`;
    }),
  );
  return metadata.join('\n');
};

const rebuild = async () => {
  if (building || stopping) {
    rebuildPending = true;
    return;
  }

  building = true;
  do {
    rebuildPending = false;
    try {
      if (await build()) {
        restarting = true;
        await stopServer();
        restarting = false;
        if (!stopping) startServer();
      }
    } catch (error) {
      if (!stopping) console.error('Unable to rebuild server', error);
    }
  } while (!stopping && rebuildPending);
  building = false;
};

const queueRebuild = () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void rebuild(), 100);
};

const pollSources = async () => {
  try {
    const nextSourceState = await readSourceState();
    if (nextSourceState !== sourceState) {
      sourceState = nextSourceState;
      queueRebuild();
    }
  } catch (error) {
    if (!stopping) console.error('Unable to inspect server sources', error);
  }
};

const stop = async () => {
  if (stopping) return;
  stopping = true;
  clearTimeout(debounceTimer);
  clearInterval(pollTimer);
  activeCommand?.kill('SIGTERM');
  await stopServer();
};

process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());

const initialBuildSucceeded = await build();
if (!stopping) {
  sourceState = await readSourceState();
  pollTimer = setInterval(() => void pollSources(), 500);
  if (initialBuildSucceeded) startServer();
}
