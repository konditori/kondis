import { JobName, QueueName } from 'src/enum';
import type { JobItem } from 'src/types/jobs';

export type CloudJobConsumer = 'node' | 'worker';
export type QueuePolicy = 'exclusive' | 'standard';

/**
 * The runtime which owns a cloud job. Self-hosted installations ignore this
 * map and continue to execute every job through pg-boss.
 */
export const CLOUD_JOB_CONSUMER: Record<JobName, CloudJobConsumer> = {
  [JobName.AuthCredentialCleanup]: 'worker',
  [JobName.ActivityUpload]: 'node',
  [JobName.ActivityMetricCompute]: 'node',
  [JobName.ActivityBestEffortCompute]: 'node',
  [JobName.ActivityBestEffortRank]: 'node',
  [JobName.ActivityRouteMatchCompute]: 'node',
  [JobName.ActivityParse]: 'node',
  [JobName.ActivityManualCreate]: 'node',
  [JobName.ActivityParseQueueAll]: 'node',
  [JobName.ActivityDelete]: 'node',
  [JobName.ActivityImageIngest]: 'node',
  [JobName.ActivityImageAttach]: 'node',
  [JobName.ActivityImageGenerateThumbnails]: 'node',
  [JobName.ActivityImageGenerateQueueAll]: 'node',
  [JobName.LagomTakeoutImport]: 'node',
  [JobName.UserAvatarUpload]: 'node',
  [JobName.FileDelete]: 'node',
  [JobName.TemporaryFileCleanup]: 'node',
};

export const JOB_QUEUE: Record<JobName, QueueName> = {
  [JobName.AuthCredentialCleanup]: QueueName.BackgroundTask,
  [JobName.ActivityUpload]: QueueName.BackgroundTask,
  [JobName.ActivityMetricCompute]: QueueName.ActivityParsing,
  [JobName.ActivityBestEffortCompute]: QueueName.ActivityParsing,
  [JobName.ActivityBestEffortRank]: QueueName.ActivityParsing,
  [JobName.ActivityRouteMatchCompute]: QueueName.ActivityParsing,
  [JobName.ActivityParse]: QueueName.ActivityParsing,
  [JobName.ActivityManualCreate]: QueueName.ActivityParsing,
  [JobName.ActivityParseQueueAll]: QueueName.BackgroundTask,
  [JobName.ActivityDelete]: QueueName.BackgroundTask,
  [JobName.ActivityImageIngest]: QueueName.ImageProcessing,
  [JobName.ActivityImageAttach]: QueueName.ImageProcessing,
  [JobName.ActivityImageGenerateThumbnails]: QueueName.ImageProcessing,
  [JobName.ActivityImageGenerateQueueAll]: QueueName.BackgroundTask,
  [JobName.LagomTakeoutImport]: QueueName.BackgroundTask,
  [JobName.UserAvatarUpload]: QueueName.ImageProcessing,
  [JobName.FileDelete]: QueueName.Storage,
  [JobName.TemporaryFileCleanup]: QueueName.Storage,
};

export const getJobOptions = (item: JobItem): { singletonKey?: string; priority?: number } => {
  switch (item.name) {
    case JobName.AuthCredentialCleanup: {
      return { singletonKey: item.name };
    }
    case JobName.ActivityUpload: {
      return {
        singletonKey: `${item.name}:${item.data.checksum ?? item.data.storagePath}`,
      };
    }
    case JobName.ActivityMetricCompute: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityBestEffortCompute: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityRouteMatchCompute: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityParse: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityManualCreate: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityDelete: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityBestEffortRank: {
      return {
        singletonKey: `${item.name}:${crypto.randomUUID()}`,
        priority: -1,
      };
    }
    case JobName.ActivityImageIngest: {
      return { singletonKey: `${item.name}:${item.data.imageId}` };
    }
    case JobName.ActivityImageAttach: {
      return { singletonKey: `${item.name}:${item.data.uploadId}` };
    }
    case JobName.ActivityImageGenerateThumbnails: {
      return { singletonKey: `${item.name}:${item.data.id}` };
    }
    case JobName.ActivityImageGenerateQueueAll: {
      return { singletonKey: item.name };
    }
    case JobName.ActivityParseQueueAll: {
      return { singletonKey: item.name };
    }
    case JobName.TemporaryFileCleanup: {
      return { singletonKey: item.name };
    }
    case JobName.LagomTakeoutImport: {
      return {};
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
  [QueueName.ActivityParsing]: 'exclusive',
  [QueueName.BackgroundTask]: 'exclusive',
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
  [QueueName.ActivityParsing]: 1,
  [QueueName.BackgroundTask]: 1,
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
