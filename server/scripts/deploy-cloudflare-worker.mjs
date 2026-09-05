import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { generateCloudflareConfig, parseJsonc } = require('./generate-cloudflare-config.cjs');

const environment = process.env.CLOUDFLARE_ENV ?? 'staging';
if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(environment)) {
  throw new Error('CLOUDFLARE_ENV must be 1-32 lowercase letters, digits, or hyphens');
}
const hyperdriveId = process.env.KONDIS_HYPERDRIVE_ID;
if (!hyperdriveId) {
  throw new Error('KONDIS_HYPERDRIVE_ID is required to deploy the Worker');
}
if (!/^[a-f0-9]{32}$/i.test(hyperdriveId)) {
  throw new Error('KONDIS_HYPERDRIVE_ID must be a 32-character Cloudflare resource ID');
}
const nodeProcessorSetting = process.env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED;
if (nodeProcessorSetting && !['false', 'true'].includes(nodeProcessorSetting)) {
  throw new Error('KONDIS_CLOUD_NODE_PROCESSOR_ENABLED must be true or false when set');
}

const serverDir = resolve(import.meta.dirname, '..');
const baseConfig = parseJsonc(await readFile(resolve(serverDir, 'wrangler.jsonc'), 'utf8'));
const environmentConfig = generateCloudflareConfig({
  baseConfig,
  environment,
  hyperdriveId,
  nodeProcessorEnabled: nodeProcessorSetting === 'true',
});
const outputPath = resolve(serverDir, `wrangler-generated-${environment}.json`);
await writeFile(outputPath, `${JSON.stringify(environmentConfig, null, 2)}\n`);

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const childEnvironment = { ...process.env };
delete childEnvironment.CLOUDFLARE_ENV;
const child = spawn(command, ['exec', 'wrangler', 'deploy', '--config', outputPath], {
  cwd: serverDir,
  env: childEnvironment,
  stdio: 'inherit',
});
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exitCode = code ?? 1;
});
