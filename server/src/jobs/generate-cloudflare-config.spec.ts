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
  vars: { KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: string };
  r2_buckets: { binding: string; bucket_name: string }[];
  durable_objects: { bindings: { name: string; class_name: string }[] };
  migrations: { tag: string; new_sqlite_classes: string[] }[];
  hyperdrive: { binding: string; id: string }[];
  services: { binding: string; service: string }[];
  queues: {
    producers: { binding: string; queue: string }[];
    consumers: {
      queue: string;
      max_retries: number;
      max_batch_size: number;
      retry_delay?: number;
      max_concurrency: number;
      dead_letter_queue?: string;
    }[];
  };
  triggers: { crons: string[] };
};

const require = createRequire(import.meta.url);
const { generateCloudflareConfig, generateQueueExecutorConfig, parseJsonc } = require('../../scripts/generate-cloudflare-config.cjs') as {
  generateCloudflareConfig(input: {
    baseConfig: Record<string, unknown>;
    environment: string;
    hyperdriveId: string;
    nodeProcessorEnabled?: boolean;
  }): GeneratedConfig;
  generateQueueExecutorConfig(input: {
    baseConfig: Record<string, unknown>;
    environment: string;
    hyperdriveId: string;
  }): Record<string, unknown>;
  parseJsonc(source: string): Record<string, unknown>;
};

describe('generateCloudflareConfig', () => {
  it('parses JSONC URLs without treating the protocol as a comment', () => {
    expect(parseJsonc('{ "url": "https://api.internal",\n }')).toEqual({ url: 'https://api.internal' });
  });

  it('derives every queue and cron setting from shared job semantics', () => {
    const config = generateCloudflareConfig({
      baseConfig: { name: 'kondis-api', main: 'src/cloudflare/entrypoint.ts' },
      environment: 'staging',
      hyperdriveId: 'a'.repeat(32),
    });

    expect(config.name).toBe('kondis-api-staging');
    expect(config.vars).toEqual({ KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: 'false' });
    expect(config.r2_buckets).toEqual([{ binding: 'STORAGE_BUCKET', bucket_name: 'kondis-api-staging-storage' }]);
    expect(config.durable_objects).toEqual({
      bindings: [{ name: 'REALTIME', class_name: 'RealtimeDurableObject' }],
    });
    expect(config.migrations).toEqual([{ tag: 'realtime-v1', new_sqlite_classes: ['RealtimeDurableObject'] }]);
    expect(config.hyperdrive).toEqual([{ binding: 'HYPERDRIVE', id: 'a'.repeat(32) }]);
    expect(config.services).toEqual([{ binding: 'QUEUE_EXECUTOR', service: 'kondis-api-staging-queue-executor' }]);
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
          max_batch_size: 1,
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

  it('enables anonymous read-only demo access only when a demo user is configured', () => {
    const config = generateCloudflareConfig({
      baseConfig: { name: 'public-demo-api', main: 'src/cloudflare/entrypoint.ts' },
      environment: 'preview',
      hyperdriveId: 'd'.repeat(32),
      demoUserId: '33333333-3333-4333-8333-333333333333',
    });

    expect(config.vars).toEqual({
      KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: 'false',
      KONDIS_DEMO_USER_ID: '33333333-3333-4333-8333-333333333333',
    });
  });

  it('enables Node-owned schedules only when the cloud processor is ready', () => {
    const config = generateCloudflareConfig({
      baseConfig: { name: 'kondis-api', main: 'src/cloudflare/entrypoint.ts' },
      environment: 'production',
      hyperdriveId: 'b'.repeat(32),
      nodeProcessorEnabled: true,
    });

    expect(config.vars).toEqual({ KONDIS_CLOUD_NODE_PROCESSOR_ENABLED: 'true' });
    expect(config.triggers.crons).toEqual([...CRON_JOBS.map(({ cron }) => cron), '* * * * *']);
  });

  it('creates a private, Stockholm-placed executor using existing resources', () => {
    const config = generateQueueExecutorConfig({
      baseConfig: { name: 'kondis-api', main: 'src/cloudflare/entrypoint.ts' },
      environment: 'staging',
      hyperdriveId: 'c'.repeat(32),
    });

    expect(config).toMatchObject({
      name: 'kondis-api-staging-queue-executor',
      main: 'src/cloudflare/queue-executor.ts',
      workers_dev: false,
      preview_urls: false,
      placement: { region: 'aws:eu-north-1' },
      hyperdrive: [{ binding: 'HYPERDRIVE', id: 'c'.repeat(32) }],
      durable_objects: {
        bindings: [{ name: 'REALTIME', class_name: 'RealtimeDurableObject', script_name: 'kondis-api-staging' }],
      },
    });
    expect(config).not.toHaveProperty('migrations');
    expect(config).not.toHaveProperty('triggers');
    expect((config.queues as { producers: unknown[] }).producers).toHaveLength(Object.values(QueueName).length);
  });
});
