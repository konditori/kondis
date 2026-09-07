import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = resolve(rootDir, 'server');
const webDir = resolve(rootDir, 'web');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const environmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const hyperdrivePattern = /^[a-f0-9]{32}$/i;

const usage = () => `Usage: pnpm deploy:cloudflare <environment> [--dry-run] [--config-dir <path>]

Required environment:
 KONDIS_HYPERDRIVE_ID  Hyperdrive ID created by Terraform
 KONDIS_DEMO_MODE     Set to true for the immutable public demo deployment

Examples:
  pnpm deploy:cloudflare worker-name
  pnpm deploy:cloudflare worker-name --dry-run
`;

const run = (cwd, args, { capture = false } = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(pnpmCommand, args, {
      cwd,
      // The environment is encoded into the generated config. Do not let
      // Wrangler interpret CLOUDFLARE_ENV as a separate Wrangler environment.
      env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'CLOUDFLARE_ENV')),
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      const output = [stdout, stderr].filter(Boolean).join('\n').trim();
      reject(new Error(`pnpm ${args.join(' ')} failed with exit code ${code}${output ? `\n${output}` : ''}`));
    });
  });

const runWrangler = (args, options) => run(serverDir, ['exec', 'wrangler', ...args], options);

const isAlreadyExistsError = (error) =>
  /already exists|already been created|already in use|already taken|code:\s*(?:10004|11009)/i.test(
    String(error?.message ?? error),
  );

const createR2Bucket = async (bucketName) => {
  console.log(`Creating R2 bucket: ${bucketName}`);
  try {
    await runWrangler(['r2', 'bucket', 'create', bucketName], { capture: true });
    console.log(`R2 bucket created: ${bucketName}`);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.log(`R2 bucket already exists: ${bucketName}`);
      return;
    }
    throw error;
  }
};

const createQueue = async (queueName) => {
  console.log(`Creating queue: ${queueName}`);
  try {
    await runWrangler(['queues', 'create', queueName], { capture: true });
    console.log(`Queue created: ${queueName}`);
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      console.log(`Queue already exists: ${queueName}`);
      return;
    }
    throw error;
  }
};

const readJsonc = async (path, parseJsonc) => parseJsonc(await readFile(path, 'utf8'));

const parseArguments = () => {
  const argumentsList = process.argv.slice(2);
  const dryRun = argumentsList.includes('--dry-run');
  const positional = [];
  let configDirArgument;

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--dry-run') continue;
    if (argument === '--config-dir') {
      const nextArgument = argumentsList[index + 1];
      if (!nextArgument || nextArgument.startsWith('--')) {
        throw new Error(`--config-dir requires a path.\n\n${usage()}`);
      }
      configDirArgument = nextArgument;
      index += 1;
      continue;
    }
    positional.push(argument);
  }

  if (positional.includes('--help') || positional.includes('-h')) {
    console.log(usage());
    process.exit(0);
  }
  if (positional.length > 1) throw new Error(`Expected one environment name.\n\n${usage()}`);
  if (!configDirArgument && argumentsList.includes('--config-dir')) {
    throw new Error(`--config-dir requires a path.\n\n${usage()}`);
  }

  const environment = positional[0] || process.env.CLOUDFLARE_ENV;
  if (!environment || !environmentPattern.test(environment)) {
    throw new Error(
      `Invalid or missing environment. Use a lowercase name such as "worker-name".\n\n${usage()}`,
    );
  }

  const hyperdriveId = process.env.KONDIS_HYPERDRIVE_ID;
  if (!hyperdriveId || !hyperdrivePattern.test(hyperdriveId)) {
    throw new Error(
      'KONDIS_HYPERDRIVE_ID must be the 32-character Hyperdrive ID produced by Terraform. ' +
        'Hyperdrive and Cloudflare Access are not provisioned by this script.',
    );
  }

  const nodeProcessorEnabled = process.env.KONDIS_CLOUD_NODE_PROCESSOR_ENABLED || 'false';
  if (!['true', 'false'].includes(nodeProcessorEnabled)) {
    throw new Error('KONDIS_CLOUD_NODE_PROCESSOR_ENABLED must be either true or false.');
  }

  const demoModeSetting = process.env.KONDIS_DEMO_MODE || 'false';
  if (!['true', 'false'].includes(demoModeSetting)) {
    throw new Error('KONDIS_DEMO_MODE must be either true or false.');
  }
  const demoMode = demoModeSetting === 'true';
  return {
    environment,
    dryRun,
    hyperdriveId,
    nodeProcessorEnabled: nodeProcessorEnabled === 'true',
    demoMode,
    configDir: configDirArgument ? resolve(rootDir, configDirArgument) : undefined,
  };
};

const main = async () => {
  const { environment, dryRun, hyperdriveId, nodeProcessorEnabled, demoMode, configDir } = parseArguments();
  const require = createRequire(resolve(serverDir, 'scripts/generate-cloudflare-config.cjs'));
  const {
    generateCloudflareConfig,
    generateQueueExecutorConfig,
    parseJsonc,
  } = require(resolve(serverDir, 'scripts/generate-cloudflare-config.cjs'));

  const apiBaseConfig = await readJsonc(
    configDir ? resolve(configDir, 'wrangler-api.jsonc') : resolve(serverDir, 'wrangler.jsonc'),
    parseJsonc,
  );
  const webBaseConfig = await readJsonc(
    configDir ? resolve(configDir, 'wrangler-web.jsonc') : resolve(webDir, 'wrangler.jsonc'),
    parseJsonc,
  );
  const apiConfig = generateCloudflareConfig({
    baseConfig: apiBaseConfig,
    environment,
    hyperdriveId,
    nodeProcessorEnabled,
    demoMode,
  });
  const executorConfig = demoMode
    ? undefined
    : generateQueueExecutorConfig({ baseConfig: apiBaseConfig, environment, hyperdriveId });
  const apiWorkerName = apiConfig.name;
  const webConfig = {
    ...webBaseConfig,
    name: `${webBaseConfig.name}-${environment}`,
    vars: {
      ...(webBaseConfig.vars || {}),
      ...(demoMode ? { KONDIS_DEMO_MODE: 'true' } : {}),
    },
    services: (webBaseConfig.services || []).map((service) =>
      service.binding === 'KONDIS_API' ? { ...service, service: apiWorkerName } : service,
    ),
    ...(demoMode && environment === 'production'
      ? { routes: [{ pattern: 'demo.kondis.org', custom_domain: true }] }
      : {}),
  };

  const configOutputDir = configDir || serverDir;
  const apiConfigPath = configDir
    ? resolve(configOutputDir, `wrangler-generated-${environment}-api.json`)
    : resolve(serverDir, `wrangler-generated-${environment}.json`);
  const executorConfigPath = resolve(configOutputDir, `wrangler-generated-${environment}-queue-executor.json`);
  const webConfigPath = configDir
    ? resolve(configOutputDir, `wrangler-generated-${environment}-web.json`)
    : resolve(webDir, `wrangler-generated-${environment}.json`);
  await writeFile(apiConfigPath, `${JSON.stringify(apiConfig, null, 2)}\n`);
  if (executorConfig) {
    await writeFile(executorConfigPath, `${JSON.stringify(executorConfig, null, 2)}\n`);
  }
  await writeFile(webConfigPath, `${JSON.stringify(webConfig, null, 2)}\n`);

  const bucketNames = (apiConfig.r2_buckets || []).map(({ bucket_name }) => bucket_name).filter(Boolean);
  const queueNames = [...new Set((apiConfig.queues?.consumers || []).map(({ queue }) => queue).filter(Boolean))];

  console.log(`Cloudflare environment: ${environment}`);
  console.log(`API Worker: ${apiWorkerName}`);
  console.log(`Queue executor: ${executorConfig?.name || 'not deployed (demo mode)'}`);
  console.log(`Web Worker: ${webConfig.name}`);
  console.log(`Hyperdrive: configured from Terraform (${hyperdriveId.slice(0, 6)}…${hyperdriveId.slice(-4)})`);
  console.log(`R2 buckets: ${bucketNames.join(', ') || 'none'}`);
  console.log(`Queues: ${queueNames.join(', ') || 'none'}`);
  console.log(`Generated API config: ${apiConfigPath}`);
  if (executorConfig) console.log(`Generated queue executor config: ${executorConfigPath}`);
  console.log(`Generated web config: ${webConfigPath}`);

  if (dryRun) {
    console.log('Dry run: skipping resource provisioning, build, and deployment.');
    return;
  }

  for (const bucketName of bucketNames) await createR2Bucket(bucketName);
  for (const queueName of queueNames) await createQueue(queueName);

  if (executorConfig) {
    console.log(`Deploying queue executor first: ${executorConfig.name}`);
    await runWrangler(['deploy', '--config', executorConfigPath]);
  }

  console.log(`Deploying API Worker: ${apiWorkerName}`);
  await runWrangler(['deploy', '--config', apiConfigPath]);

  console.log('Building SDK');
  await run(rootDir, ['--filter', '@kondis/sdk', 'run', 'build']);

  console.log(`Building web Worker: ${webConfig.name}`);
  await run(webDir, ['run', 'build']);

  console.log(`Deploying web Worker: ${webConfig.name}`);
  await run(webDir, ['exec', 'wrangler', 'deploy', '--config', webConfigPath]);
  console.log('Cloudflare deployment complete.');
};

main().catch((error) => {
  console.error(`[deploy:cloudflare] ${error.message}`);
  process.exitCode = 1;
});
