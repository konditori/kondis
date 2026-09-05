import { describe, expect, it, vi } from 'vitest';

import { CloudflareQueueTransportAdapter } from 'src/adapters/cloudflare/queue-transport.adapter';
import { QueueName } from 'src/enum';
import { JOB_DELIVERY_MESSAGE_VERSION, type JobDeliveryEnvelope } from 'src/ports/job-transport.port';

const envelope = (jobId = 'ba5eba11-0000-4000-a000-000000000000'): JobDeliveryEnvelope => ({
  jobId,
  queue: QueueName.BackgroundTask,
  version: JOB_DELIVERY_MESSAGE_VERSION,
});

describe(CloudflareQueueTransportAdapter.name, () => {
  it('publishes through the Cloudflare batch API when available', async () => {
    const send = vi.fn(() => Promise.resolve());
    const sendBatch = vi.fn(() => Promise.resolve());
    const transport = new CloudflareQueueTransportAdapter({
      [QueueName.BackgroundTask]: { send, sendBatch },
    });
    const messages = [envelope(), envelope('ba5eba11-0000-4000-a000-000000000001')];

    await transport.publishBatch(QueueName.BackgroundTask, messages);

    expect(sendBatch).toHaveBeenCalledWith(messages.map((body) => ({ body })));
    expect(send).not.toHaveBeenCalled();
  });

  it('falls back to individual sends and rejects missing bindings', async () => {
    const send = vi.fn(() => Promise.resolve());
    const transport = new CloudflareQueueTransportAdapter({
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
    const transport = new CloudflareQueueTransportAdapter();

    const batch = transport.toDeliveryBatch({ messages: [{ body: envelope(), ack, retry }] });
    batch.deliveries[0]?.acknowledge();
    batch.deliveries[0]?.retry();

    expect(batch.deliveries[0]?.payload).toEqual(envelope());
    expect(ack).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
  });
});
