import { QueueName } from 'src/enum';

export const JOB_SCHEMA = 'kondis_jobs';
export const JOB_CONCURRENCY: Record<QueueName, number> = {
  [QueueName.ActivityParsing]: 1,
  [QueueName.BackgroundTask]: 1,
  [QueueName.ImageProcessing]: 2,
  [QueueName.Storage]: 2,
};
export const JOB_RETRY_LIMIT = 3;
export const JOB_RETRY_DELAY_SECONDS = 5;
export const JOB_EXPIRE_SECONDS = 900;
export const JOB_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const JOB_CRON = true;
