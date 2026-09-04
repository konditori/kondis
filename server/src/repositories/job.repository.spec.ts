import { describe, expect, it, vi } from 'vitest';

import { JobName, JobStatus, QueueName } from 'src/enum';
import { ConfigRepository } from 'src/repositories/config.repository';
import { AnyJobHandlerDescriptor, JobRepository } from 'src/repositories/job.repository';
import type { JobItem } from 'src/types/jobs';

type JobOptionsAccessor = {
  getJobOptions(item: JobItem): { singletonKey?: string };
};

const getJobOptions = (item: JobItem) => {
  const repository = new JobRepository({} as ConfigRepository, false);

  return (repository as unknown as JobOptionsAccessor).getJobOptions(item);
};

const makeHandlers = (): AnyJobHandlerDescriptor[] =>
  Object.values(JobName).map((jobName) => ({
    jobName,
    queueName: QueueName.BackgroundTask,
    handler: vi.fn(() => Promise.resolve(JobStatus.Success)),
    label: `TestService.${jobName}`,
  })) as AnyJobHandlerDescriptor[];

describe('JobRepository handler registration', () => {
  it('rejects duplicate handlers with useful labels', () => {
    const repository = new JobRepository({} as ConfigRepository, false);
    const handlers = makeHandlers();
    repository.setup(handlers);

    expect(() => repository.setup([{ ...handlers[0]!, label: 'DuplicateService.handle' }])).toThrow(
      `Failed to add job handler for DuplicateService.handle. JobName.${handlers[0]!.jobName} is already handled by ${handlers[0]!.label}.`,
    );
  });

  it('requires a handler for every JobName', () => {
    const repository = new JobRepository({} as ConfigRepository, false);
    const handlers = makeHandlers();

    expect(() => repository.setup(handlers.slice(1))).toThrow(
      `Failed to find a job handler for JobName.${handlers[0]!.jobName}`,
    );
  });
});

describe('JobRepository activity-upload deduplication', () => {
  it('uses the staged path when a disk-backed upload has no checksum', () => {
    const first = getJobOptions({
      name: JobName.ActivityUpload,
      data: { originalName: 'first.fit', storagePath: 'temporary/first.fit' },
    });
    const second = getJobOptions({
      name: JobName.ActivityUpload,
      data: { originalName: 'second.fit', storagePath: 'temporary/second.fit' },
    });

    expect(first.singletonKey).toBe('ActivityUpload:temporary/first.fit');
    expect(second.singletonKey).toBe('ActivityUpload:temporary/second.fit');
    expect(first.singletonKey).not.toBe(second.singletonKey);
  });

  it('keeps checksum-based deduplication for buffered uploads', () => {
    const options = getJobOptions({
      name: JobName.ActivityUpload,
      data: {
        originalName: 'run.fit',
        storagePath: 'temporary/run.fit',
        checksum: 'checksum',
      },
    });

    expect(options.singletonKey).toBe('ActivityUpload:checksum');
  });
});
