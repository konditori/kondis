import { describe, expect, it } from 'vitest';

import { JobName, QueueName } from 'src/enum';
import {
  CLOUD_JOB_CONSUMER,
  JOB_QUEUE,
  JOB_RETRY_DELAY_SECONDS,
  getJobFailureTransition,
} from 'src/jobs/job-semantics';

const WORKER_JOB_NAMES = new Set([
  JobName.AuthCredentialCleanup,
  JobName.ActivityUpload,
  JobName.ActivityParse,
  JobName.ActivityManualCreate,
  JobName.ActivityMetricCompute,
  JobName.ActivityBestEffortCompute,
  JobName.ActivityBestEffortRank,
  JobName.ActivityRouteMatchCompute,
]);

describe('cloud job semantics', () => {
  it('assigns every job to exactly one queue and cloud consumer', () => {
    expect(Object.keys(JOB_QUEUE).sort()).toEqual(Object.values(JobName).sort());
    expect(Object.keys(CLOUD_JOB_CONSUMER).sort()).toEqual(Object.values(JobName).sort());
    expect(new Set(Object.values(JOB_QUEUE))).toEqual(new Set(Object.values(QueueName)));
    for (const name of Object.values(JobName)) {
      expect(CLOUD_JOB_CONSUMER[name]).toBe(WORKER_JOB_NAMES.has(name) ? 'worker' : 'node');
    }
  });

  it('treats the retry limit as retries after the initial attempt', () => {
    expect(getJobFailureTransition(0, 3)).toEqual({
      delaySeconds: JOB_RETRY_DELAY_SECONDS,
      exhausted: false,
      retryCount: 1,
    });
    expect(getJobFailureTransition(2, 3)).toEqual({
      delaySeconds: JOB_RETRY_DELAY_SECONDS * 4,
      exhausted: false,
      retryCount: 3,
    });
    expect(getJobFailureTransition(3, 3)).toEqual({
      delaySeconds: JOB_RETRY_DELAY_SECONDS * 8,
      exhausted: true,
      retryCount: 4,
    });
  });
});
