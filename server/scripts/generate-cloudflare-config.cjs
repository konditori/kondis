const { delimiter, resolve } = require('node:path');
const Module = require('node:module');

// The server TypeScript sources use the `src/*` tsconfig path alias. This
// script is loaded directly by Node, outside of the TypeScript toolchain, so
// expose the server root to CommonJS resolution before loading the sources.
process.env.NODE_PATH = [resolve(__dirname, '..'), process.env.NODE_PATH].filter(Boolean).join(delimiter);
Module._initPaths();
require('@swc-node/register');

const {
  CLOUD_JOB_CONSUMER,
  CRON_JOBS,
  JOB_CONCURRENCY,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
  QUEUE_POLICY,
} = require(resolve(__dirname, '../src/jobs/job-semantics.ts'));

const queueBinding = (queue) => `${queue.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_QUEUE`;

const queueName = (prefix, queue) => `${prefix}-${queue.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;

const stripJsoncComments = (source) => {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
    } else if (character === '/' && nextCharacter === '/') {
      index += 1;
      while (index + 1 < source.length && source[index + 1] !== '\n' && source[index + 1] !== '\r') {
        index += 1;
      }
    } else if (character === '/' && nextCharacter === '*') {
      index += 1;
      while (index + 1 < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 1;
    } else {
      result += character;
    }
  }

  return result;
};

const removeJsoncTrailingCommas = (source) => {
  let result = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === ',') {
      let nextIndex = index + 1;
      while (/\s/.test(source[nextIndex] || '')) nextIndex += 1;
      if (source[nextIndex] === '}' || source[nextIndex] === ']') {
        index = nextIndex - 1;
        continue;
      }
    }

    result += character;
  }

  return result;
};

const parseJsonc = (source) => JSON.parse(removeJsoncTrailingCommas(stripJsoncComments(source)));

const generateCloudflareConfig = ({
  baseConfig,
  environment,
  hyperdriveId,
  nodeProcessorEnabled = false,
  demoMode = false,
}) => {
  const prefix = demoMode ? baseConfig.name : `${baseConfig.name}-${environment}`;
  const demoBaseConfig = (() => {
    const {
      r2_buckets: _r2Buckets,
      durable_objects: _durableObjects,
      migrations: _migrations,
      services: _services,
      queues: _queues,
      triggers: _triggers,
      ...config
    } = baseConfig;
    return config;
  })();
  const commonConfig = {
    ...(demoMode ? demoBaseConfig : baseConfig),
    name: prefix,
    vars: {
      ...((demoMode ? demoBaseConfig : baseConfig).vars || {}),
      KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: nodeProcessorEnabled ? 'true' : 'false',
      ...(demoMode ? { KONDIS_DEMO_MODE: 'true' } : {}),
    },
    hyperdrive: [{ binding: 'HYPERDRIVE', id: hyperdriveId }],
  };

  if (demoMode) {
    return commonConfig;
  }

  const queues = Object.entries(JOB_CONCURRENCY).map(([queue, concurrency]) => {
    const name = queueName(prefix, queue);
    const deadLetterQueue = `${name}-dlq`;
    return {
      queue,
      name,
      deadLetterQueue,
      binding: queueBinding(queue),
      concurrency,
      policy: QUEUE_POLICY[queue],
    };
  });

  return {
    ...commonConfig,
    r2_buckets: [{ binding: 'STORAGE_BUCKET', bucket_name: `${prefix}-storage` }],
    durable_objects: {
      bindings: [{ name: 'REALTIME', class_name: 'RealtimeDurableObject' }],
    },
    migrations: [{ tag: 'realtime-v1', new_sqlite_classes: ['RealtimeDurableObject'] }],
    services: [...(baseConfig.services || []), { binding: 'QUEUE_EXECUTOR', service: `${prefix}-queue-executor` }],
    queues: {
      producers: queues.map(({ binding, name }) => ({ binding, queue: name })),
      consumers: queues.flatMap(({ name, deadLetterQueue, concurrency }) => [
        {
          queue: name,
          max_batch_size: 1,
          max_batch_timeout: 5,
          max_retries: JOB_RETRY_LIMIT,
          retry_delay: JOB_RETRY_DELAY_SECONDS,
          max_concurrency: concurrency,
          dead_letter_queue: deadLetterQueue,
        },
        {
          queue: deadLetterQueue,
          max_batch_size: 1,
          max_batch_timeout: 5,
          max_retries: 0,
          max_concurrency: 1,
        },
      ]),
    },
    triggers: {
      crons: [
        ...CRON_JOBS.filter(({ item }) => nodeProcessorEnabled || CLOUD_JOB_CONSUMER[item.name] === 'worker').map(
          ({ cron }) => cron,
        ),
        '* * * * *',
      ],
    },
  };
};

const generateQueueExecutorConfig = ({ baseConfig, environment, hyperdriveId }) => {
  const prefix = `${baseConfig.name}-${environment}`;
  const queues = Object.keys(JOB_CONCURRENCY);
  const {
    durable_objects: _durableObjects,
    migrations: _migrations,
    queues: _queues,
    triggers: _triggers,
    ...config
  } = baseConfig;
  return {
    ...config,
    name: `${prefix}-queue-executor`,
    main: 'src/cloudflare/queue-executor.ts',
    workers_dev: false,
    preview_urls: false,
    placement: { region: 'aws:eu-north-1' },
    r2_buckets: [{ binding: 'STORAGE_BUCKET', bucket_name: `${prefix}-storage` }],
    durable_objects: {
      bindings: [{ name: 'REALTIME', class_name: 'RealtimeDurableObject', script_name: prefix }],
    },
    hyperdrive: [{ binding: 'HYPERDRIVE', id: hyperdriveId }],
    queues: {
      producers: queues.map((queue) => ({ binding: queueBinding(queue), queue: queueName(prefix, queue) })),
    },
  };
};

module.exports = { generateCloudflareConfig, generateQueueExecutorConfig, parseJsonc };
