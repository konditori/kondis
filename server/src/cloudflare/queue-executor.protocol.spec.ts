import { describe, expect, it } from 'vitest';

import {
  isQueueExecutorRequest,
  isQueueExecutorResponse,
  queueExecutorRequest,
  queueExecutorResponse,
} from 'src/cloudflare/queue-executor.protocol';
import { QueueName } from 'src/enum';

describe('queue executor protocol', () => {
  it('accepts a valid request and result', () => {
    expect(isQueueExecutorRequest(queueExecutorRequest(QueueName.ActivityParsing, [{ jobId: 'job' }]))).toBe(true);
    expect(isQueueExecutorResponse(queueExecutorResponse(['acknowledge']), 1)).toBe(true);
  });

  it('rejects malformed or incomplete results', () => {
    expect(isQueueExecutorRequest({ version: 1, queue: 'unknown', deliveries: [] })).toBe(false);
    expect(isQueueExecutorResponse({ version: 1, outcomes: ['acknowledge'] }, 2)).toBe(false);
    expect(isQueueExecutorResponse({ version: 1, outcomes: ['invalid'] }, 1)).toBe(false);
  });
});
