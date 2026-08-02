import { SetMetadata } from '@nestjs/common';

import { JobName, MetadataKey, QueueName } from 'src/enum';

export type JobConfig = {
  name: JobName;
  queue: QueueName;
};

/**
 * Marks a method as the handler for a job.
 *
 * This decorator is the whole reason the dependency graph stays acyclic. A producer calls
 * `jobRepository.queue({ name: JobName.X, ... })`; the repository finds the handler by
 * reflecting over service instances at startup and never imports one. So `UploadService` can
 * trigger parsing without importing `ActivityService`, and neither knows the other exists.
 *
 * The handler must be a method on a class listed in `src/services/index.ts` — that array is
 * what gets scanned — and must return a `JobStatus`.
 */
export const OnJob = (config: JobConfig) => SetMetadata(MetadataKey.JobConfig, config);
