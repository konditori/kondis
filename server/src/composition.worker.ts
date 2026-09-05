import type { CloudflareQueueBinding } from 'src/adapters/cloudflare/queue-transport.adapter';
import { CloudflareQueueAdapter } from 'src/adapters/cloudflare/queue.adapter';
import { createPortableWorkerHandlers } from 'src/cloudflare/queue-handler';
import { createHyperdriveDatabase } from 'src/db/hyperdrive';

export type WorkerBindings = {
  HYPERDRIVE: { connectionString: string };
  HYPERDRIVE_SPIKE_TOKEN?: string;
  ACTIVITY_PARSING_QUEUE?: CloudflareQueueBinding;
  BACKGROUND_TASK_QUEUE?: CloudflareQueueBinding;
  IMAGE_PROCESSING_QUEUE?: CloudflareQueueBinding;
  STORAGE_QUEUE?: CloudflareQueueBinding;
};

/**
 * Worker invocations must not retain database clients across requests. This
 * composition owns exactly one invocation-scoped client and its adapters.
 */
export const createWorkerInvocationComposition = (env: WorkerBindings) => {
  if (!env.HYPERDRIVE?.connectionString) {
    throw new Error('HYPERDRIVE is required for this Worker invocation');
  }
  const { db: database, close } = createHyperdriveDatabase(env.HYPERDRIVE.connectionString);
  const queueAdapter = new CloudflareQueueAdapter(database);

  return {
    close,
    database,
    jobAdmin: queueAdapter,
    jobHandlers: createPortableWorkerHandlers(database),
    jobProducer: queueAdapter,
  };
};

export type WorkerInvocationComposition = ReturnType<typeof createWorkerInvocationComposition>;
