import { createRoute } from '@hono/zod-openapi';
import type { ExecutionContext } from 'hono';

import {
  CloudflareQueueTransportAdapter,
  type CloudflareQueueBatch,
  type CloudflareQueueBinding,
} from 'src/adapters/cloudflare/queue-transport.adapter';
import { createWorkerFileReader } from 'src/adapters/cloudflare/storage.adapter';
import { workerUploadReader } from 'src/adapters/cloudflare/upload.adapter';
import { createApiShell } from 'src/api/app';
import {
  registerWorkerActivityUploadRoute,
  registerWorkerPortableRouteGroups,
  registerWorkerQueueMutationRoutes,
  registerWorkerStorageMutationRouteGroups,
  registerWorkerStorageReadRouteGroups,
  registerWorkerTakeoutImportRoutes,
} from 'src/api/route-groups';
import { registerAuthRoutes } from 'src/api/routes/auth';
import type { AuthenticatedUser } from 'src/auth';
import {
  drainUnpublishedJobs,
  purgeExpiredJobs,
  reclaimStaleJobs,
  recoverOrphanedPublishedJobs,
  runScheduledCron,
} from 'src/cloudflare/dispatcher';
import { runHyperdriveSpike } from 'src/cloudflare/hyperdrive-spike';
import {
  isQueueExecutorResponse,
  QUEUE_EXECUTOR_PATH,
  queueExecutorRequest,
} from 'src/cloudflare/queue-executor.protocol';
import { handleDeadLetterBatch } from 'src/cloudflare/queue-handler';
import { REALTIME_DURABLE_OBJECT_NAME } from 'src/cloudflare/realtime-durable-object';
import { createWorkerInvocationComposition, type WorkerBindings } from 'src/composition.worker';
import { createHyperdriveDatabase } from 'src/db/hyperdrive';
import { provisionDemoData } from 'src/demo/provisioner';
import { PingResponseSchema } from 'src/dtos/ping.dto';
import { JobName, QueueName } from 'src/enum';
import { isWebsocketEvent } from 'src/realtime/protocol';

export { RealtimeDurableObject } from 'src/cloudflare/realtime-durable-object';

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

type WorkerApp = ReturnType<typeof createApiShell>;

const createRequestApp = (
  composition: ReturnType<typeof createWorkerInvocationComposition>,
  demoUser?: AuthenticatedUser,
): WorkerApp => {
  const requestApp = createApiShell(composition.authCredentialRepository, demoUser);
  requestApp.openapi(pingRoute, (context) => context.json({ status: 'pong' }, 200));
  registerWorkerPortableRouteGroups(requestApp, {
    activities: composition.activityService,
    jobs: composition.jobService,
    liveWorkouts: composition.liveWorkoutService,
    social: composition.socialService,
    users: composition.userRepository,
  });
  registerAuthRoutes(requestApp, composition.authService, composition.userRepository, composition.config, {
    includeEventTickets: composition.realtimeEnabled,
  });
  if (composition.cloudNodeProcessorEnabled && composition.queueBindingsConfigured) {
    registerWorkerQueueMutationRoutes(requestApp, { jobs: composition.jobService });
  }
  if (
    composition.storage &&
    composition.workerActivityImageService &&
    composition.workerUploadService &&
    composition.workerUserService
  ) {
    const storageRoutes = {
      activityImages: composition.workerActivityImageService,
      files: createWorkerFileReader(composition.storage),
      uploads: workerUploadReader,
      uploadService: composition.workerUploadService,
      userService: composition.workerUserService,
    };
    registerWorkerStorageReadRouteGroups(requestApp, storageRoutes);
    registerWorkerStorageMutationRouteGroups(requestApp, storageRoutes);
    if (composition.queueBindingsConfigured) {
      registerWorkerActivityUploadRoute(requestApp, storageRoutes);
      // Browser extraction has no Node-only dependency, so this is available
      // whenever the Worker can accept and queue normal activity files.
      registerWorkerTakeoutImportRoutes(requestApp, storageRoutes);
    }
  }
  requestApp.post('/api/v1/_internal/auth-credential-cleanup', async (context) => {
    const token = composition.authCredentialCleanupToken;
    if (!token) {
      return context.json({ statusCode: 404, message: 'Not Found' }, 404);
    }
    if (context.req.header('Authorization') !== `Bearer ${token}`) {
      return context.json({ statusCode: 401, message: 'Unauthorized' }, 401);
    }
    await composition.jobProducer.queue({ name: JobName.AuthCredentialCleanup, data: {} });
    return context.body(null, 202);
  });
  requestApp.post('/api/v1/_internal/realtime-publish', async (context) => {
    const env = context.env as WorkerEnv;
    if (!env.REALTIME || !env.KONDIS_REALTIME_PUBLISH_TOKEN) {
      return context.json({ statusCode: 404, message: 'Not Found' }, 404);
    }
    if (context.req.header('Authorization') !== `Bearer ${env.KONDIS_REALTIME_PUBLISH_TOKEN}`) {
      return context.json({ statusCode: 401, message: 'Unauthorized' }, 401);
    }
    let event: unknown;
    try {
      event = await context.req.json();
    } catch {
      return context.json({ statusCode: 400, message: 'Bad Request' }, 400);
    }
    if (!isWebsocketEvent(event)) {
      return context.json({ statusCode: 400, message: 'Bad Request' }, 400);
    }
    const target = env.REALTIME.get(env.REALTIME.idFromName(REALTIME_DURABLE_OBJECT_NAME));
    const response = await target.fetch('https://realtime.internal/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
    });
    return context.body(null, response.ok ? 204 : 502);
  });
  requestApp.get('/api/v1/_internal/hyperdrive-spike', async (context) => {
    const env = context.env as WorkerEnv;
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
  requestApp.get('/api/v1/openapi.json', (context) =>
    context.json(
      requestApp.getOpenAPIDocument({
        openapi: '3.0.0',
        info: { title: 'Kondis API', description: 'Cloudflare Worker API boundary', version: '0.0.0' },
        servers: [{ url: '/api/v1' }],
      }),
    ),
  );
  return requestApp;
};

export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Promise<Response> {
    if (!env.HYPERDRIVE) {
      if (new URL(request.url).pathname === '/api/v1/ping' && request.method === 'GET') {
        return Response.json({ status: 'pong' });
      }
      return Response.json({ statusCode: 404, message: 'Not Found' }, { status: 404 });
    }
    const composition = createWorkerInvocationComposition(env);
    try {
      const demoMode = composition.config.demoMode;
      const demoUser = demoMode
        ? await provisionDemoData({
            database: composition.database,
            activities: composition.activityRepository,
            uploads: composition.uploadRepository,
            fit: composition.fitRepository,
          })
        : undefined;
      if (demoMode && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        return Response.json(
          { statusCode: 405, message: 'This demo is read-only' },
          { status: 405, headers: { Allow: 'GET, HEAD, OPTIONS' } },
        );
      }
      if (isRealtimeUpgrade(request)) {
        return handleRealtimeUpgrade(request, composition, env);
      }
      const requestApp = createRequestApp(composition, demoUser);
      const response = await requestApp.fetch(request, env, _ctx);
      if (
        response.ok &&
        request.method === 'POST' &&
        (new URL(request.url).pathname.endsWith('/upload/activity') ||
          new URL(request.url).pathname.endsWith('/activities') ||
          new URL(request.url).pathname.endsWith('/manual-activities')) &&
        composition.queueBindingsConfigured
      ) {
        _ctx.waitUntil(dispatchWorkerJobs(env));
      }
      return demoMode && isDemoCacheable(request, response) ? withDemoCacheHeaders(response) : response;
    } finally {
      await composition.close();
    }
  },

  async queue(batch: WorkerQueueBatch, env: WorkerEnv): Promise<void> {
    if (!env.HYPERDRIVE) {
      throw new Error('Hyperdrive is required for queue processing');
    }
    const queue = parseQueueBindingName(batch.queue);
    if (!queue) {
      throw new Error(`Unexpected Cloudflare Queue consumer binding: ${batch.queue}`);
    }
    if (!queue.deadLetter) {
      await executeQueueBatch(env, queue.name, batch);
      return;
    }
    const composition = createWorkerInvocationComposition(env);
    try {
      const transport = createQueueTransport(env);
      {
        await handleDeadLetterBatch(
          transport.toDeliveryBatch(batch),
          composition.database,
          queue.name,
          composition.realtime,
        );
      }
      await drainUnpublishedJobs(composition.database, transport);
    } finally {
      await composition.close();
    }
  },

  async scheduled(event: ScheduledEvent, env: WorkerEnv): Promise<void> {
    if (!env.HYPERDRIVE) {
      throw new Error('Hyperdrive is required for scheduled jobs');
    }
    const composition = createWorkerInvocationComposition(env);
    const db = composition.database;
    try {
      if (event.cron === '* * * * *') {
        const reclaimed = await reclaimStaleJobs(db);
        await recoverOrphanedPublishedJobs(db);
        await purgeExpiredJobs(db);
        const transport = createQueueTransport(env);
        await drainUnpublishedJobs(db, transport);
        if (reclaimed > 0) {
          await composition.realtime.emit('JobUpdated');
        }
      } else {
        await runScheduledCron(db, event.cron);
      }
    } finally {
      await composition.close();
    }
  },
};

const isDemoCacheable = (request: Request, response: Response): boolean => {
  const path = new URL(request.url).pathname;
  return request.method === 'GET' && response.ok && !path.includes('/events') && !path.includes('/_internal/');
};

const withDemoCacheHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

const executeQueueBatch = async (env: WorkerEnv, queue: QueueName, batch: WorkerQueueBatch): Promise<void> => {
  if (!env.QUEUE_EXECUTOR) {
    throw new Error('QUEUE_EXECUTOR is required for queue processing');
  }
  const response = await env.QUEUE_EXECUTOR.fetch(
    new Request(`https://queue-executor.internal${QUEUE_EXECUTOR_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        queueExecutorRequest(
          queue,
          batch.messages.map((message) => message.body),
        ),
      ),
    }),
  );
  if (!response.ok) {
    throw new Error(`Queue executor failed with HTTP ${response.status}`);
  }
  const result: unknown = await response.json();
  if (!isQueueExecutorResponse(result, batch.messages.length)) {
    throw new Error('Queue executor returned an invalid delivery result');
  }
  for (const [index, outcome] of result.outcomes.entries()) {
    if (outcome === 'acknowledge') {
      batch.messages[index].ack();
    } else {
      batch.messages[index].retry();
    }
  }
};

const isRealtimeUpgrade = (request: Request): boolean =>
  (new URL(request.url).pathname === '/events' || new URL(request.url).pathname === '/api/v1/events') &&
  request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

const handleRealtimeUpgrade = async (
  request: Request,
  composition: ReturnType<typeof createWorkerInvocationComposition>,
  env: WorkerEnv,
): Promise<Response> => {
  if (!env.REALTIME) {
    return Response.json({ statusCode: 404, message: 'Not Found' }, { status: 404 });
  }
  const ticket = new URL(request.url).searchParams.get('ticket');
  const verified = await composition.authCredentialRepository.findEventTicket(ticket);
  if (!verified || (verified.scope === 'activity-events' && !verified.userId)) {
    console.warn('Realtime WebSocket ticket rejected', {
      hasTicket: Boolean(ticket),
      path: new URL(request.url).pathname,
    });
    return Response.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
  }
  const id = env.REALTIME.idFromName(REALTIME_DURABLE_OBJECT_NAME);
  const target = env.REALTIME.get(id);
  const url = new URL('https://realtime.internal/connect');
  url.searchParams.set('scope', verified.scope);
  url.searchParams.set('sessionId', verified.sessionId);
  url.searchParams.set('sessionExpiresAt', String(verified.sessionExpiresAt.getTime()));
  if (verified.userId) {
    url.searchParams.set('userId', verified.userId);
  }
  const headers = new Headers(request.headers);
  headers.set('Upgrade', 'websocket');
  try {
    const response = await target.fetch(new Request(url, { headers }));
    console.log('Realtime Durable Object upgrade response', {
      scope: verified.scope,
      status: response.status,
    });
    return response;
  } catch (error) {
    console.error('Realtime Durable Object upgrade failed', {
      error: error instanceof Error ? error.message : String(error),
      scope: verified.scope,
    });
    return Response.json({ statusCode: 502, message: 'Realtime service unavailable' }, { status: 502 });
  }
};

const requiredQueue = (queue: CloudflareQueueBinding | undefined, name: QueueName): CloudflareQueueBinding => {
  if (!queue) {
    throw new Error(`Missing Cloudflare Queue binding for ${name}`);
  }
  return queue;
};

const createQueueTransport = (env: WorkerEnv): CloudflareQueueTransportAdapter =>
  new CloudflareQueueTransportAdapter({
    [QueueName.ActivityParsing]: requiredQueue(env.ACTIVITY_PARSING_QUEUE, QueueName.ActivityParsing),
    [QueueName.ActivityEnrichment]: requiredQueue(env.ACTIVITY_ENRICHMENT_QUEUE, QueueName.ActivityEnrichment),
    [QueueName.BackgroundTask]: requiredQueue(env.BACKGROUND_TASK_QUEUE, QueueName.BackgroundTask),
    [QueueName.ImageProcessing]: requiredQueue(env.IMAGE_PROCESSING_QUEUE, QueueName.ImageProcessing),
    [QueueName.Storage]: requiredQueue(env.STORAGE_QUEUE, QueueName.Storage),
  });

const dispatchWorkerJobs = async (env: WorkerEnv): Promise<void> => {
  const { db, close } = createHyperdriveDatabase(env.HYPERDRIVE.connectionString);
  try {
    await drainUnpublishedJobs(db, createQueueTransport(env));
  } finally {
    await close();
  }
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
