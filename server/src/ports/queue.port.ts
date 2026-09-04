import type { JobName, JobStatus, QueueName } from 'src/enum';
import type { KondisTransaction } from 'src/types';
import type { JobCounts, JobHistoryEntry, JobItem } from 'src/types/jobs';

export type QueueJobOptions = { transaction?: KondisTransaction };

export type JobProducerPort = {
  discardQueuedDuplicates: (itemName: JobName) => Promise<void>;
  queue: (item: JobItem, options?: QueueJobOptions) => Promise<void>;
  queueAll: (items: JobItem[], options?: QueueJobOptions) => Promise<void>;
};

export type JobAdminPort = {
  clearFailed: (queue: QueueName) => Promise<void>;
  empty: (queue: QueueName) => Promise<void>;
  getAllJobCounts?: () => Promise<Record<QueueName, JobCounts>>;
  getJobCounts: (queue: QueueName) => Promise<JobCounts>;
  getJobHistory: (limit: number, offset?: number) => Promise<{ jobs: JobHistoryEntry[]; total: number }>;
  getReferencedTemporaryPaths: () => Promise<Set<string>>;
  isPaused: (queue: QueueName) => boolean;
  pause: (queue: QueueName) => Promise<void>;
  resume: (queue: QueueName) => Promise<void>;
};

export type JobConsumerPort = {
  run: (item: JobItem) => Promise<JobStatus>;
  startWorkers: (onJobRun: (item: JobItem) => Promise<JobStatus>) => Promise<void>;
  stop: () => Promise<void>;
};

export type QueuePort = JobProducerPort & JobAdminPort & JobConsumerPort;
