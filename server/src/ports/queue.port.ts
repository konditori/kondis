import type { JobName, JobStatus, QueueName } from 'src/enum';
import type { KondisTransaction } from 'src/types';
import type { JobCounts, JobHistoryEntry, JobItem } from 'src/types/jobs';

export type QueueJobOptions = { transaction?: KondisTransaction };

export type QueuePort = {
  clearFailed: (queue: QueueName) => Promise<void>;
  discardQueuedDuplicates: (itemName: JobName) => Promise<void>;
  empty: (queue: QueueName) => Promise<void>;
  getAllJobCounts?: () => Promise<Record<QueueName, JobCounts>>;
  getJobCounts: (queue: QueueName) => Promise<JobCounts>;
  getJobHistory: (limit: number, offset?: number) => Promise<{ jobs: JobHistoryEntry[]; total: number }>;
  isPaused: (queue: QueueName) => boolean;
  pause: (queue: QueueName) => Promise<void>;
  queue: (item: JobItem, options?: QueueJobOptions) => Promise<void>;
  queueAll: (items: JobItem[], options?: QueueJobOptions) => Promise<void>;
  resume: (queue: QueueName) => Promise<void>;
  run: (item: JobItem) => Promise<JobStatus>;
  startWorkers: (onJobRun: (item: JobItem) => Promise<JobStatus>) => Promise<void>;
};
