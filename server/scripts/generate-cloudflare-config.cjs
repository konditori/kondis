const { resolve } = require('node:path');

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

const parseJsonc = (source) => JSON.parse(source.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));

const generateCloudflareConfig = ({ baseConfig, environment, hyperdriveId, nodeProcessorEnabled = false }) => {
  const prefix = `${baseConfig.name}-${environment}`;
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
    ...baseConfig,
    name: prefix,
    hyperdrive: [{ binding: 'HYPERDRIVE', id: hyperdriveId }],
    queues: {
      producers: queues.map(({ binding, name }) => ({ binding, queue: name })),
      consumers: queues.flatMap(({ name, deadLetterQueue, concurrency }) => [
        {
          queue: name,
          max_batch_size: 10,
          max_batch_timeout: 5,
          max_retries: JOB_RETRY_LIMIT,
          retry_delay: JOB_RETRY_DELAY_SECONDS,
          max_concurrency: concurrency,
          dead_letter_queue: deadLetterQueue,
        },
        {
          queue: deadLetterQueue,
          max_batch_size: 10,
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

module.exports = { generateCloudflareConfig, parseJsonc };
