import type { QueuePolicy } from 'pg-boss';
import { JobName, QueueName } from 'src/enum';
import type { JobItem } from 'src/types/jobs';

export const QUEUE_POLICY: Record<QueueName, QueuePolicy> = {
  [QueueName.ActivityParsing]: 'exclusive',
  [QueueName.BackgroundTask]: 'exclusive',
  [QueueName.ImageProcessing]: 'standard',
  [QueueName.Storage]: 'standard',
};

export const CRON_JOBS: { item: JobItem; cron: string }[] = [
  { item: { name: JobName.AuthCredentialCleanup, data: {} }, cron: '15 * * * *' },
  { item: { name: JobName.ActivityParseQueueAll, data: { force: false } }, cron: '30 3 * * *' },
  { item: { name: JobName.TemporaryFileCleanup, data: {} }, cron: '0 4 * * *' },
  { item: { name: JobName.ActivityImageGenerateQueueAll, data: { force: false } }, cron: '30 4 * * *' },
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
