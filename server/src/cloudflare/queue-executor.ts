import { handleQueueBatch } from 'src/cloudflare/job-delivery';
import {
  QUEUE_EXECUTOR_PATH,
  isQueueExecutorRequest,
  queueExecutorResponse,
} from 'src/cloudflare/queue-executor.protocol';
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
        composition.postgresJobService,
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
        body.queue,
      );
      await composition.postgresJobService.drainUnpublishedJobs();
      return Response.json(queueExecutorResponse(outcomes));
    } finally {
      await composition.close();
    }
  },
};
