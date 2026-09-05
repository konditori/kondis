import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import type { ExecutionContext } from 'hono';

import {
  CloudflareQueueTransportAdapter,
  type CloudflareQueueBatch,
  type CloudflareQueueBinding,
} from 'src/adapters/cloudflare/queue-transport.adapter';
import {
  drainUnpublishedJobs,
  purgeExpiredJobs,
  reclaimStaleJobs,
  recoverOrphanedPublishedJobs,
  runScheduledCron,
} from 'src/cloudflare/dispatcher';
import { runHyperdriveSpike } from 'src/cloudflare/hyperdrive-spike';
import { handleDeadLetterBatch, handleQueueBatch } from 'src/cloudflare/queue-handler';
import { createWorkerInvocationComposition, type WorkerBindings } from 'src/composition.worker';
import { PingResponseSchema } from 'src/dtos/ping.dto';
import { QueueName } from 'src/enum';

export type WorkerEnv = WorkerBindings;

type ScheduledEvent = { cron: string };
type WorkerQueueBatch = CloudflareQueueBatch & { queue: string };

const pingRoute = createRoute({
  method: 'get',
  path: '/api/v1/ping',
  operationId: 'ServerController_ping',
  responses: {
    200: {
      description: 'The API is reachable',
      content: { 'application/json': { schema: PingResponseSchema } },
    },
  },
  summary: 'Health check endpoint',
  tags: ['server'],
});

type WorkerApp = OpenAPIHono<{ Bindings: WorkerEnv }>;
let app: WorkerApp | undefined;

const getApp = (): WorkerApp => {
  if (app) {
    return app;
  }

  const nextApp = new OpenAPIHono<{ Bindings: WorkerEnv }>();
  nextApp.openapi(pingRoute, (context) => context.json({ status: 'pong' }, 200));
  nextApp.get('/api/v1/_internal/hyperdrive-spike', async (context) => {
    const env = context.env;
    if (!env.HYPERDRIVE || !env.HYPERDRIVE_SPIKE_TOKEN) {
      return context.json({ statusCode: 404, message: 'Not Found' }, 404);
    }
    if (context.req.header('Authorization') !== `Bearer ${env.HYPERDRIVE_SPIKE_TOKEN}`) {
      return context.json({ statusCode: 401, message: 'Unauthorized' }, 401);
    }

    try {
      return context.json(await runHyperdriveSpike(env.HYPERDRIVE.connectionString), 200);
    } catch (error) {
      console.error('Hyperdrive spike failed', error);
      return context.json({ statusCode: 502, message: 'Hyperdrive spike failed' }, 502);
    }
  });
  nextApp.get('/api/v1/openapi.json', (context) =>
    context.json(
      nextApp.getOpenAPIDocument({
        openapi: '3.0.0',
        info: {
          title: 'Kondis API',
          description: 'Cloudflare Worker API boundary',
          version: '0.0.0',
        },
        servers: [{ url: '/api/v1' }],
      }),
    ),
  );

  app = nextApp;
  return nextApp;
};

export default {
  fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Response | Promise<Response> {
    return getApp().fetch(request, env, _ctx);
  },

  async queue(batch: WorkerQueueBatch, env: WorkerEnv): Promise<void> {
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE is required for queue processing');
    }
    const composition = createWorkerInvocationComposition(env);
    try {
      const transport = new CloudflareQueueTransportAdapter();
      const queue = parseQueueBindingName(batch.queue);
      if (!queue) {
        throw new Error(`Unexpected Cloudflare Queue consumer binding: ${batch.queue}`);
      }
      if (queue.deadLetter) {
        await handleDeadLetterBatch(transport.toDeliveryBatch(batch), composition.database, queue.name);
      } else {
        await handleQueueBatch(
          transport.toDeliveryBatch(batch),
          composition.database,
          composition.jobHandlers,
          queue.name,
        );
      }
    } finally {
      await composition.close();
    }
  },

  async scheduled(event: ScheduledEvent, env: WorkerEnv): Promise<void> {
    if (!env.HYPERDRIVE) {
      throw new Error('HYPERDRIVE is required for scheduled jobs');
    }
    const composition = createWorkerInvocationComposition(env);
    const db = composition.database;
    try {
      if (event.cron === '* * * * *') {
        await reclaimStaleJobs(db);
        await recoverOrphanedPublishedJobs(db);
        await purgeExpiredJobs(db);
        const transport = new CloudflareQueueTransportAdapter({
          [QueueName.ActivityParsing]: requiredQueue(env.ACTIVITY_PARSING_QUEUE, QueueName.ActivityParsing),
          [QueueName.BackgroundTask]: requiredQueue(env.BACKGROUND_TASK_QUEUE, QueueName.BackgroundTask),
          [QueueName.ImageProcessing]: requiredQueue(env.IMAGE_PROCESSING_QUEUE, QueueName.ImageProcessing),
          [QueueName.Storage]: requiredQueue(env.STORAGE_QUEUE, QueueName.Storage),
        });
        await drainUnpublishedJobs(db, transport);
      } else {
        await runScheduledCron(db, event.cron);
      }
    } finally {
      await composition.close();
    }
  },
};

const requiredQueue = (queue: CloudflareQueueBinding | undefined, name: QueueName): CloudflareQueueBinding => {
  if (!queue) {
    throw new Error(`Missing Cloudflare Queue binding for ${name}`);
  }
  return queue;
};

export const parseQueueBindingName = (bindingName: string): { deadLetter: boolean; name: QueueName } | undefined => {
  for (const name of Object.values(QueueName)) {
    const resourceName = name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    if (bindingName === `${resourceName}-dlq` || bindingName.endsWith(`-${resourceName}-dlq`)) {
      return { deadLetter: true, name };
    }
    if (bindingName === resourceName || bindingName.endsWith(`-${resourceName}`)) {
      return { deadLetter: false, name };
    }
  }
  return undefined;
};
