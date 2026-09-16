import type { JobName, QueueName } from 'src/enum';
import type { KondisTransaction } from 'src/types';
import type { JobCounts, JobHistoryEntry, JobItem } from 'src/types/jobs';

export type QueueJobOptions = { transaction?: KondisTransaction };

export abstract class JobRepository {
  abstract queue(item: JobItem, options?: QueueJobOptions): Promise<void>;
  abstract queueAll(items: JobItem[], options?: QueueJobOptions): Promise<void>;
  abstract discardQueuedDuplicates(itemName: JobName): Promise<void>;
  abstract getJobCounts(queue: QueueName): Promise<JobCounts>;
  abstract getAllJobCounts(): Promise<Record<QueueName, JobCounts>>;
  abstract getJobHistory(limit: number, offset?: number): Promise<{ jobs: JobHistoryEntry[]; total: number }>;
  abstract getReferencedTemporaryPaths(): Promise<Set<string>>;
  abstract isPaused(queue: QueueName): boolean;
  abstract pause(queue: QueueName): Promise<void>;
  abstract resume(queue: QueueName): Promise<void>;
  abstract empty(queue: QueueName): Promise<void>;
  abstract clearFailed(queue: QueueName): Promise<void>;
}
