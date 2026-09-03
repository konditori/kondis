import { exec, spawn } from 'node:child_process';
import { setTimeout } from 'node:timers';

const setup = async () => {
  let _resolve: () => unknown;
  let _reject: (error: Error) => unknown;

  const ready = new Promise<void>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  const timeout = setTimeout(() => _reject(new Error('Timeout starting e2e environment')), 60_000);
  let output = '';

  const command = 'compose up --build --renew-anon-volumes --force-recreate --remove-orphans';
  const child = spawn('docker', command.split(' '), { stdio: 'pipe' });

  child.stdout.on('data', (data) => {
    const input = data.toString();
    output += input;
    console.log(input);
    const setupToken = output.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
    if (setupToken) {
      process.env.KONDIS_SETUP_TOKEN = setupToken;
    }
    if (input.includes('Nest application successfully started')) {
      _resolve();
    }
  });

  child.stderr.on('data', (data) => console.log(data.toString()));

  await ready;
  clearTimeout(timeout);

  return async () => {
    await new Promise<void>((resolve) => exec('docker compose down', () => resolve()));
  };
};

export default setup;
