import { exec, spawn } from 'node:child_process';
import { unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers';

const setupTokenFile = resolve(import.meta.dirname, '../.setup-token');

const setup = async () => {
  let _resolve: () => unknown;
  let _reject: (error: Error) => unknown;

  const ready = new Promise<void>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  const timeout = setTimeout(() => _reject(new Error('Timeout starting e2e environment')), 60_000);
  let output = '';
  let serverReady = false;
  let setupToken: string | undefined;

  const command = 'compose up --build --renew-anon-volumes --force-recreate --remove-orphans';
  const child = spawn('docker', command.split(' '), { stdio: 'pipe' });

  const handleOutput = (data: Buffer) => {
    const input = data.toString();
    output += input;
    console.log(input);
    const setupOutput = output.split('You will need the following setup token:', 2)[1];
    setupToken ??= setupOutput
      ?.split('\n')
      .map((line) => line.replace(/^.*?\|/, '').trim())
      .find(Boolean);
    if (input.includes('Kondis api listening on')) {
      serverReady = true;
    }
    if (serverReady && setupToken) {
      _resolve();
    }
  };

  child.stdout.on('data', handleOutput);
  child.stderr.on('data', handleOutput);

  await ready;
  clearTimeout(timeout);
  if (!setupToken) {
    throw new Error('Setup token was not present in the server startup log');
  }
  await writeFile(setupTokenFile, setupToken);

  return async () => {
    await new Promise<void>((resolve) => exec('docker compose down', () => resolve()));
    try {
      await unlink(setupTokenFile);
    } catch {
      // The token file may not exist if startup failed before it was written.
    }
  };
};

export default setup;
