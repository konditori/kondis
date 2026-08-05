import { SetMetadata } from '@nestjs/common';

import { JobName, MetadataKey, QueueName } from 'src/enum';

export type JobConfig = {
  name: JobName;
  queue: QueueName;
};

export const OnJob = (config: JobConfig) => SetMetadata(MetadataKey.JobConfig, config);
