import type { QueueName } from 'src/enum';
import type { JobDeliveryBatch, JobDeliveryEnvelope, JobPublisherPort } from 'src/ports/job-transport.port';

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

export class CloudflareQueueTransportAdapter implements JobPublisherPort {
  constructor(private readonly queues: CloudflareQueueBindings = {}) {}

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

  toDeliveryBatch(batch: CloudflareQueueBatch): JobDeliveryBatch {
    return {
      deliveries: batch.messages.map((message) => ({
        payload: message.body,
        acknowledge: () => message.ack(),
        retry: () => message.retry(),
      })),
    };
  }
}
