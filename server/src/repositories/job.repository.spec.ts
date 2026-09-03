import { describe, expect, it } from 'vitest';

import { ConfigRepository } from 'src/repositories/config.repository';
import { JobName } from 'src/enum';
import { JobRepository } from 'src/repositories/job.repository';
import type { JobItem } from 'src/types/jobs';

type JobOptionsAccessor = {
  getJobOptions(item: JobItem): { singletonKey?: string };
};

const getJobOptions = (item: JobItem) => {
  const repository = new JobRepository(
    {} as ConstructorParameters<typeof JobRepository>[0],
    {} as ConstructorParameters<typeof JobRepository>[1],
    {} as ConfigRepository,
  );

  return (repository as unknown as JobOptionsAccessor).getJobOptions(item);
};

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
