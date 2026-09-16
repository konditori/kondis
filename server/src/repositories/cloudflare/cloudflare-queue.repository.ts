import { type JobDeliveryEnvelope, QueueRepository } from 'src/contracts/queue.repository';
import type { QueueName } from 'src/enum';

export type CloudflareQueueBinding = {
  send: (message: JobDeliveryEnvelope) => Promise<unknown>;
  sendBatch?: (messages: Iterable<{ body: JobDeliveryEnvelope }>) => Promise<unknown>;
};

export type CloudflareQueueMessage = {
  body: unknown;
  ack: () => void;
  retry: (options?: { delaySeconds?: number }) => void;
};

export type CloudflareQueueBatch = {
  messages: readonly CloudflareQueueMessage[];
};

export type CloudflareQueueBindings = Partial<Record<QueueName, CloudflareQueueBinding>>;

export class CloudflareQueueRepository extends QueueRepository {
  constructor(private readonly queues: CloudflareQueueBindings = {}) {
    super();
  }

  async publishBatch(queue: QueueName, messages: readonly JobDeliveryEnvelope[]): Promise<void> {
    const binding = this.queues[queue];
    if (!binding) {
      throw new Error(`No Cloudflare Queue binding configured for ${queue}`);
    }
    if (binding.sendBatch) {
      await binding.sendBatch(messages.map((body) => ({ body })));
      return;
    }
    await Promise.all(messages.map((message) => binding.send(message)));
  }
}
