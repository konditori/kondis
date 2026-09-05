import type { QueueName } from 'src/enum';

export const JOB_DELIVERY_MESSAGE_VERSION = 1 as const;

export type JobDeliveryEnvelope = {
  jobId: string;
  queue: QueueName;
  version: typeof JOB_DELIVERY_MESSAGE_VERSION;
};

export type JobPublisherPort = {
  publishBatch: (queue: QueueName, messages: readonly JobDeliveryEnvelope[]) => Promise<void>;
};

export type JobDelivery = {
  payload: unknown;
  acknowledge: () => void;
  retry: () => void;
};

export type JobDeliveryBatch = {
  deliveries: readonly JobDelivery[];
};
