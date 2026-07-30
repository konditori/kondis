import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';

import { ConfigService } from 'src/config/config.service';
import { ParseActivityFileHandler } from 'src/jobs/handlers/parse-activity-file.handler';
import { IJobRepository, JOB_REPOSITORY } from 'src/repositories/job.repository';
import { JobHandlers, JobName } from 'src/jobs/job.types';
import { WorkerType } from 'src/types';

/**
 * Top of the dependency graph: the one place that knows both the job names and the handlers
 * that service them.
 *
 * Handlers are *pushed into* the queue implementation rather than imported by it. That is the
 * detail that breaks what would otherwise be an unavoidable cycle:
 *
 *   UploadService -> IJobRepository -> handler -> ActivityService
 *
 * Because `IJobRepository` only ever receives a callback map, nothing below this file imports
 * a handler, and producers stay ignorant of consumers.
 */
@Injectable()
export class JobService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(JOB_REPOSITORY) private readonly jobs: IJobRepository,
    private readonly parseActivityFile: ParseActivityFileHandler,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.hasWorker(WorkerType.JOBS)) {
      this.logger.log("Worker role 'jobs' is disabled; not consuming jobs in this process");
      return;
    }

    await this.jobs.startWorkers(this.buildHandlers());
  }

  /**
   * Exhaustive by construction: `JobHandlers` is mapped over `JobName`, so adding a job name
   * without adding it here fails to compile.
   */
  private buildHandlers(): JobHandlers {
    return {
      [JobName.PARSE_ACTIVITY_FILE]: (data) => this.parseActivityFile.handle(data),
    };
  }
}
