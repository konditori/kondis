import { CloudflareQueueTransportAdapter } from 'src/adapters/cloudflare/queue-transport.adapter';
import { drainUnpublishedJobs } from 'src/cloudflare/dispatcher';
import {
  QUEUE_EXECUTOR_PATH,
  isQueueExecutorRequest,
  queueExecutorResponse,
} from 'src/cloudflare/queue-executor.protocol';
import { handleQueueBatch } from 'src/cloudflare/queue-handler';
import { createWorkerInvocationComposition, type WorkerBindings } from 'src/composition.worker';

export default {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    if (request.method !== 'POST' || new URL(request.url).pathname !== QUEUE_EXECUTOR_PATH) {
      return new Response('Not Found', { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    if (!isQueueExecutorRequest(body)) {
      return new Response('Bad Request', { status: 400 });
    }

    const composition = createWorkerInvocationComposition(env);
    const outcomes: ('acknowledge' | 'retry')[] = body.deliveries.map(() => 'retry');
    try {
      await handleQueueBatch(
        {
          deliveries: body.deliveries.map((payload, index) => ({
            payload,
            acknowledge: () => {
              outcomes[index] = 'acknowledge';
            },
            retry: () => {
              outcomes[index] = 'retry';
            },
          })),
        },
        composition.database,
        composition.jobHandlers,
        body.queue,
        composition.realtime,
      );
      await drainUnpublishedJobs(composition.database, createQueueTransport(env));
      return Response.json(queueExecutorResponse(outcomes));
    } finally {
      await composition.close();
    }
  },
};

const createQueueTransport = (env: WorkerBindings): CloudflareQueueTransportAdapter =>
  new CloudflareQueueTransportAdapter({
    activityParsing: requiredQueue(env.ACTIVITY_PARSING_QUEUE),
    activityEnrichment: requiredQueue(env.ACTIVITY_ENRICHMENT_QUEUE),
    backgroundTask: requiredQueue(env.BACKGROUND_TASK_QUEUE),
    imageProcessing: requiredQueue(env.IMAGE_PROCESSING_QUEUE),
    storage: requiredQueue(env.STORAGE_QUEUE),
  });

const requiredQueue = (queue: WorkerBindings['ACTIVITY_PARSING_QUEUE']) => {
  if (!queue) {
    throw new Error('Queue binding is required for queue processing');
  }
  return queue;
};
