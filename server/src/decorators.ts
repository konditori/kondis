import { SetMetadata } from '@nestjs/common';

import { MetadataKey } from 'src/enum';
import type { JobConfig } from 'src/types';

export const OnJob = (config: JobConfig) => SetMetadata(MetadataKey.JobConfig, config);
