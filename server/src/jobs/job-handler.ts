import { JobName, type JobStatus, type QueueName } from 'src/enum';
import { CLOUD_JOB_CONSUMER, JOB_QUEUE, type CloudJobConsumer } from 'src/jobs/job-semantics';
import type { JobItem, JobOf } from 'src/types/jobs';
import { KondisStartupError } from 'src/utils/misc';

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

export type JobHandler = (data: never) => Promise<JobStatus>;
export type JobHandlers = Partial<Record<JobName, JobHandler>>;
export type JobExecutor = (item: JobItem, options?: { notify?: boolean }) => Promise<JobStatus>;

export const createJobHandlers = (
  descriptors: readonly AnyJobHandlerDescriptor[],
  consumers?: readonly CloudJobConsumer[],
): JobHandlers => {
  const handlers: JobHandlers = {};
  const seen = new Map<JobName, string>();
  for (const descriptor of descriptors) {
    const existing = seen.get(descriptor.jobName);
    if (existing) {
      throw new KondisStartupError(
        `Failed to add job handler for ${descriptor.label}. JobName.${descriptor.jobName} is already handled by ${existing}.`,
      );
    }
    seen.set(descriptor.jobName, descriptor.label);
    if (descriptor.queueName !== JOB_QUEUE[descriptor.jobName]) {
      throw new KondisStartupError(
        `Job handler ${descriptor.label} routes ${descriptor.jobName} to ${descriptor.queueName}; shared semantics require ${JOB_QUEUE[descriptor.jobName]}.`,
      );
    }
    const consumer = descriptor.cloudConsumer ?? 'node';
    if (consumer !== CLOUD_JOB_CONSUMER[descriptor.jobName]) {
      throw new KondisStartupError(
        `Job handler ${descriptor.label} assigns ${descriptor.jobName} to the ${consumer} cloud consumer; shared semantics require ${CLOUD_JOB_CONSUMER[descriptor.jobName]}.`,
      );
    }
    if (!consumers || consumers.includes(consumer)) {
      handlers[descriptor.jobName] = descriptor.handler as JobHandler;
    }
  }
  for (const jobName of Object.values(JobName)) {
    if ((!consumers || consumers.includes(CLOUD_JOB_CONSUMER[jobName])) && !handlers[jobName]) {
      throw new KondisStartupError(`Failed to find a job handler for JobName.${jobName} ("${jobName}").`);
    }
  }
  return handlers;
};
