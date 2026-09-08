import { JobName, QueueName } from 'src/enum';
import type { JobItem } from 'src/types/jobs';

export type CloudJobConsumer = 'node' | 'worker';
export type QueuePolicy = 'exclusive' | 'standard';

export const CLOUD_JOB_CONSUMER: Record<JobName, CloudJobConsumer> = {
  [JobName.AuthCredentialCleanup]: 'worker',
  [JobName.ActivityUpload]: 'worker',
  [JobName.ActivityMetricCompute]: 'worker',
  [JobName.ActivityBestEffortCompute]: 'worker',
  [JobName.ActivityBestEffortRank]: 'worker',
  [JobName.ActivityRouteMatchCompute]: 'worker',
  [JobName.ActivityParse]: 'worker',
  [JobName.ActivityManualCreate]: 'worker',
  [JobName.ActivityParseQueueAll]: 'node',
  [JobName.ActivityDelete]: 'node',
  [JobName.ActivityImageIngest]: 'node',
  [JobName.ActivityImageAttach]: 'node',
  [JobName.ActivityImageGenerateThumbnails]: 'node',
  [JobName.ActivityImageGenerateQueueAll]: 'node',
  [JobName.UserAvatarUpload]: 'node',
  [JobName.FileDelete]: 'node',
  [JobName.TemporaryFileCleanup]: 'node',
};

export const JOB_QUEUE: Record<JobName, QueueName> = {
  [JobName.AuthCredentialCleanup]: QueueName.BackgroundTask,
  [JobName.ActivityUpload]: QueueName.BackgroundTask,
  [JobName.ActivityMetricCompute]: QueueName.ActivityEnrichment,
  [JobName.ActivityBestEffortCompute]: QueueName.ActivityEnrichment,
  [JobName.ActivityBestEffortRank]: QueueName.ActivityEnrichment,
  [JobName.ActivityRouteMatchCompute]: QueueName.ActivityEnrichment,
  [JobName.ActivityParse]: QueueName.ActivityParsing,
  [JobName.ActivityManualCreate]: QueueName.ActivityParsing,
  [JobName.ActivityParseQueueAll]: QueueName.BackgroundTask,
  [JobName.ActivityDelete]: QueueName.BackgroundTask,
  [JobName.ActivityImageIngest]: QueueName.ImageProcessing,
  [JobName.ActivityImageAttach]: QueueName.ImageProcessing,
  [JobName.ActivityImageGenerateThumbnails]: QueueName.ImageProcessing,
  [JobName.ActivityImageGenerateQueueAll]: QueueName.BackgroundTask,
  [JobName.UserAvatarUpload]: QueueName.ImageProcessing,
  [JobName.FileDelete]: QueueName.Storage,
  [JobName.TemporaryFileCleanup]: QueueName.Storage,
};

const singleton = (singletonKey: string): { singletonKey: string; singletonSeconds: number } => ({
  singletonKey,
  singletonSeconds: 60,
});

const jobKey = (singletonKey: string): { singletonKey: string } => ({ singletonKey });

export const getJobOptions = (item: JobItem): { singletonKey?: string; singletonSeconds?: number; priority?: number } => {
  switch (item.name) {
    case JobName.AuthCredentialCleanup: {
      return singleton(item.name);
    }
    case JobName.ActivityUpload: {
      return singleton(`${item.name}:${item.data.checksum ?? item.data.storagePath}`);
    }
    case JobName.ActivityMetricCompute: {
      return jobKey(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityBestEffortCompute: {
      return jobKey(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityRouteMatchCompute: {
      return jobKey(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityParse: {
      return singleton(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityManualCreate: {
      return jobKey(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityDelete: {
      return jobKey(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityBestEffortRank: {
      return {
        singletonKey: `${item.name}:${crypto.randomUUID()}`,
        priority: -1,
      };
    }
    case JobName.ActivityImageIngest: {
      return jobKey(`${item.name}:${item.data.imageId}`);
    }
    case JobName.ActivityImageAttach: {
      return jobKey(`${item.name}:${item.data.uploadId}`);
    }
    case JobName.ActivityImageGenerateThumbnails: {
      return jobKey(`${item.name}:${item.data.id}`);
    }
    case JobName.ActivityImageGenerateQueueAll: {
      return singleton(item.name);
    }
    case JobName.ActivityParseQueueAll: {
      return singleton(item.name);
    }
    case JobName.TemporaryFileCleanup: {
      return singleton(item.name);
    }
    case JobName.UserAvatarUpload: {
      return {};
    }
    case JobName.FileDelete: {
      return {};
    }
  }
};

export const QUEUE_POLICY: Record<QueueName, QueuePolicy> = {
  [QueueName.ActivityParsing]: 'standard',
  [QueueName.ActivityEnrichment]: 'standard',
  [QueueName.BackgroundTask]: 'standard',
  [QueueName.ImageProcessing]: 'standard',
  [QueueName.Storage]: 'standard',
};

export const CRON_JOBS: { item: JobItem; cron: string }[] = [
  {
    item: { name: JobName.AuthCredentialCleanup, data: {} },
    cron: '15 * * * *',
  },
  {
    item: { name: JobName.ActivityParseQueueAll, data: { force: false } },
    cron: '30 3 * * *',
  },
  { item: { name: JobName.TemporaryFileCleanup, data: {} }, cron: '0 4 * * *' },
  {
    item: {
      name: JobName.ActivityImageGenerateQueueAll,
      data: { force: false },
    },
    cron: '30 4 * * *',
  },
];

export const JOB_CONCURRENCY = {
  [QueueName.ActivityParsing]: 3,
  [QueueName.ActivityEnrichment]: 3,
  [QueueName.BackgroundTask]: 3,
  [QueueName.ImageProcessing]: 2,
  [QueueName.Storage]: 2,
} satisfies Record<QueueName, number>;
export const JOB_RETRY_LIMIT = 3;
export const JOB_RETRY_DELAY_SECONDS = 5;
export const JOB_EXPIRE_SECONDS = 900;
export const JOB_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const JOB_CRON = true;

export type JobFailureTransition = {
  delaySeconds: number;
  exhausted: boolean;
  retryCount: number;
};

// retryLimit is the number of retries after the initial attempt.
export const getJobFailureTransition = (retryCount: number, retryLimit: number): JobFailureTransition => {
  const nextRetryCount = retryCount + 1;
  return {
    delaySeconds: JOB_RETRY_DELAY_SECONDS * 2 ** retryCount,
    exhausted: nextRetryCount > retryLimit,
    retryCount: nextRetryCount,
  };
};
