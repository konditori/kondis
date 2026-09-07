import { QueueName } from 'src/enum';

export const QUEUE_EXECUTOR_PATH = '/internal/queue';
const QUEUE_EXECUTOR_VERSION = 1;

export type QueueExecutorRequest = {
  version: number;
  queue: QueueName;
  deliveries: unknown[];
};

export type QueueExecutorResponse = {
  version: number;
  outcomes: ('acknowledge' | 'retry')[];
};

export const isQueueExecutorRequest = (value: unknown): value is QueueExecutorRequest => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const request = value as Partial<QueueExecutorRequest>;
  return (
    request.version === QUEUE_EXECUTOR_VERSION &&
    typeof request.queue === 'string' &&
    Object.values(QueueName).includes(request.queue as QueueName) &&
    Array.isArray(request.deliveries)
  );
};

export const isQueueExecutorResponse = (
  value: unknown,
  deliveryCount: number,
): value is QueueExecutorResponse => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Partial<QueueExecutorResponse>;
  return (
    response.version === QUEUE_EXECUTOR_VERSION &&
    Array.isArray(response.outcomes) &&
    response.outcomes.length === deliveryCount &&
    response.outcomes.every((outcome) => outcome === 'acknowledge' || outcome === 'retry')
  );
};

export const queueExecutorRequest = (queue: QueueName, deliveries: unknown[]): QueueExecutorRequest => ({
  version: QUEUE_EXECUTOR_VERSION,
  queue,
  deliveries,
});

export const queueExecutorResponse = (outcomes: QueueExecutorResponse['outcomes']): QueueExecutorResponse => ({
  version: QUEUE_EXECUTOR_VERSION,
  outcomes,
});
