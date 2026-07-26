import { Provider } from '@nestjs/common';

import { ParseActivityFileHandler } from 'src/jobs/handlers/parse-activity-file.handler';
import { InProcessJobRepository } from 'src/jobs/in-process.job.repository';
import { JOB_REPOSITORY } from 'src/jobs/job.repository';
import { JobService } from 'src/jobs/job.service';

/**
 * Swapping the queue backend is a one-line change here: point `JOB_REPOSITORY` at a
 * `PgBossJobRepository` instead. No producer or handler changes.
 *
 * `useExisting` rather than `useClass` so the token and the class resolve to the same
 * instance, and its shutdown hook therefore runs exactly once.
 */
export const jobProviders: Provider[] = [
  InProcessJobRepository,
  { provide: JOB_REPOSITORY, useExisting: InProcessJobRepository },
  ParseActivityFileHandler,
  JobService,
];
