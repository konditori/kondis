import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { QueueName } from 'src/enum';
import {
  CLOUD_JOB_CONSUMER,
  CRON_JOBS,
  JOB_CONCURRENCY,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
} from 'src/jobs/job-semantics';

type GeneratedConfig = {
  name: string;
  hyperdrive: { binding: string; id: string }[];
  queues: {
    producers: { binding: string; queue: string }[];
    consumers: {
      queue: string;
      max_retries: number;
      retry_delay?: number;
      max_concurrency: number;
      dead_letter_queue?: string;
    }[];
  };
  triggers: { crons: string[] };
};

const require = createRequire(import.meta.url);
const { generateCloudflareConfig } = require('../../scripts/generate-cloudflare-config.cjs') as {
  generateCloudflareConfig(input: {
    baseConfig: Record<string, unknown>;
    environment: string;
    hyperdriveId: string;
    nodeProcessorEnabled?: boolean;
  }): GeneratedConfig;
};

describe('generateCloudflareConfig', () => {
  it('derives every queue and cron setting from shared job semantics', () => {
    const config = generateCloudflareConfig({
      baseConfig: { name: 'kondis-api', main: 'src/cloudflare/entrypoint.ts' },
      environment: 'staging',
      hyperdriveId: 'a'.repeat(32),
    });

    expect(config.name).toBe('kondis-api-staging');
    expect(config.hyperdrive).toEqual([{ binding: 'HYPERDRIVE', id: 'a'.repeat(32) }]);
    expect(config.queues.producers).toHaveLength(Object.values(QueueName).length);
    expect(config.queues.consumers).toHaveLength(Object.values(QueueName).length * 2);

    for (const queue of Object.values(QueueName)) {
      const resourceName = queue.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      const name = `kondis-api-staging-${resourceName}`;
      expect(config.queues.producers).toContainEqual(expect.objectContaining({ queue: name }));
      expect(config.queues.consumers).toContainEqual(
        expect.objectContaining({
          queue: name,
          max_retries: JOB_RETRY_LIMIT,
          retry_delay: JOB_RETRY_DELAY_SECONDS,
          max_concurrency: JOB_CONCURRENCY[queue],
          dead_letter_queue: `${name}-dlq`,
        }),
      );
      expect(config.queues.consumers).toContainEqual(
        expect.objectContaining({ queue: `${name}-dlq`, max_retries: 0, max_concurrency: 1 }),
      );
    }

    expect(config.triggers.crons).toEqual([
      ...CRON_JOBS.filter(({ item }) => CLOUD_JOB_CONSUMER[item.name] === 'worker').map(({ cron }) => cron),
      '* * * * *',
    ]);
  });

  it('enables Node-owned schedules only when the cloud processor is ready', () => {
    const config = generateCloudflareConfig({
      baseConfig: { name: 'kondis-api', main: 'src/cloudflare/entrypoint.ts' },
      environment: 'production',
      hyperdriveId: 'b'.repeat(32),
      nodeProcessorEnabled: true,
    });

    expect(config.triggers.crons).toEqual([...CRON_JOBS.map(({ cron }) => cron), '* * * * *']);
  });
});
