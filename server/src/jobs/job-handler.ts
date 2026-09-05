import type { JobName, JobStatus, QueueName } from 'src/enum';
import type { CloudJobConsumer } from 'src/jobs/job-semantics';
import type { JobOf } from 'src/types/jobs';

export type JobHandlerDescriptor<T extends JobName = JobName> = {
  jobName: T;
  queueName: QueueName;
  handler: (data: JobOf<T>) => Promise<JobStatus>;
  label: string;
  cloudConsumer?: CloudJobConsumer;
};

export type AnyJobHandlerDescriptor = {
  [T in JobName]: JobHandlerDescriptor<T>;
}[JobName];
