import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const environment = process.env.CLOUDFLARE_ENV ?? 'staging';
const hyperdriveId = process.env.KONDIS_HYPERDRIVE_ID;
if (!hyperdriveId) {
  throw new Error('KONDIS_HYPERDRIVE_ID is required to deploy the Worker');
}
if (!/^[a-f0-9]{32}$/i.test(hyperdriveId)) {
  throw new Error('KONDIS_HYPERDRIVE_ID must be a 32-character Cloudflare resource ID');
}

const serverDir = resolve(import.meta.dirname, '..');
const baseConfig = JSON.parse(await readFile(resolve(serverDir, 'wrangler.jsonc'), 'utf8'));
const environmentConfig = {
  ...baseConfig,
  name: `${baseConfig.name}-${environment}`,
  hyperdrive: [{ binding: 'HYPERDRIVE', id: hyperdriveId }],
};
const outputPath = resolve(serverDir, `wrangler.${environment}.generated.json`);
await writeFile(outputPath, `${JSON.stringify(environmentConfig, null, 2)}\n`);

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['exec', 'wrangler', 'deploy', '--config', outputPath], {
  cwd: serverDir,
  env: process.env,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exitCode = code ?? 1;
});
