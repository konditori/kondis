import { describe, expect, it, vi } from 'vitest';

import { toDeliveryBatch } from 'src/cloudflare/job-delivery';
import { JOB_DELIVERY_MESSAGE_VERSION, type JobDeliveryEnvelope } from 'src/contracts/queue.repository';
import { QueueName } from 'src/enum';
import { CloudflareQueueRepository } from 'src/repositories/cloudflare/cloudflare-queue.repository';

const envelope = (jobId = 'ba5eba11-0000-4000-a000-000000000000'): JobDeliveryEnvelope => ({
  jobId,
  queue: QueueName.BackgroundTask,
  version: JOB_DELIVERY_MESSAGE_VERSION,
});

describe(CloudflareQueueRepository.name, () => {
  it('publishes through the Cloudflare batch API when available', async () => {
    const send = vi.fn(() => Promise.resolve());
    const sendBatch = vi.fn(() => Promise.resolve());
    const transport = new CloudflareQueueRepository({
      [QueueName.BackgroundTask]: { send, sendBatch },
    });
    const messages = [envelope(), envelope('ba5eba11-0000-4000-a000-000000000001')];

    await transport.publishBatch(QueueName.BackgroundTask, messages);

    expect(sendBatch).toHaveBeenCalledWith(messages.map((body) => ({ body })));
    expect(send).not.toHaveBeenCalled();
  });

  it('falls back to individual sends and rejects missing bindings', async () => {
    const send = vi.fn(() => Promise.resolve());
    const transport = new CloudflareQueueRepository({
      [QueueName.BackgroundTask]: { send },
    });
    const messages = [envelope(), envelope('ba5eba11-0000-4000-a000-000000000001')];

    await transport.publishBatch(QueueName.BackgroundTask, messages);

    expect(send).toHaveBeenCalledTimes(2);
    await expect(transport.publishBatch(QueueName.Storage, messages)).rejects.toThrow(
      'No Cloudflare Queue binding configured for storage',
    );
  });

  it('adapts Cloudflare delivery controls to the transport-neutral batch shape', () => {
    const ack = vi.fn();
    const retry = vi.fn();
    const batch = toDeliveryBatch({ messages: [{ body: envelope(), ack, retry }] });
    batch.deliveries[0]?.acknowledge();
    batch.deliveries[0]?.retry();

    expect(batch.deliveries[0]?.payload).toEqual(envelope());
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
  });
});
