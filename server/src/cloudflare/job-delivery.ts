import type { JobDeliveryBatch } from 'src/contracts/queue.repository';
import type { QueueName } from 'src/enum';
import type { CloudflareQueueBatch } from 'src/repositories/cloudflare/cloudflare-queue.repository';
import type { PostgresJobService } from 'src/services/postgres-job.service';

export const toDeliveryBatch = (batch: CloudflareQueueBatch): JobDeliveryBatch => ({
  deliveries: batch.messages.map((message) => ({
    payload: message.body,
    acknowledge: () => message.ack(),
    retry: () => message.retry(),
  })),
});

/**
 * Apply transport controls only after the service has persisted the outcome.
 */
export const handleQueueBatch = async (
  service: PostgresJobService,
  batch: JobDeliveryBatch,
  queue: QueueName,
  deadLetter = false,
): Promise<void> => {
  let changed = false;
  for (const delivery of batch.deliveries) {
    const result = deadLetter
      ? await service.handleDeadLetter(delivery.payload, queue)
      : await service.handleDelivery(delivery.payload, queue);
    delivery[result.action]();
    changed ||= result.changed;
  }
  if (changed) {
    await service.notifyJobUpdates();
  }
};
