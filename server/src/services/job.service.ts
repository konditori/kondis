import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';

import { ConfigService } from 'src/config/config.service';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName, WorkerType } from 'src/enum';
import { JobRepository } from 'src/repositories/job.repository';
import { AllJobStatusResponse, JobItem, QueueStatusReport } from 'src/types';
import { asErrorMessage } from 'src/utils/misc';

/**
 * Translate the operator-facing vocabulary into the internal one.
 *
 * The two are deliberately separate. `JobName` is an implementation detail that changes as
 * work is split or merged; the manual job list is a promise to whoever is clicking the button.
 */
const asJobItem = (name: ManualJobName): JobItem => {
  switch (name) {
    case ManualJobName.ReparseFailedUploads: {
      return { name: JobName.ActivityParseQueueAll, data: { force: false } };
    }

    case ManualJobName.ReparseAllUploads: {
      return { name: JobName.ActivityParseQueueAll, data: { force: true } };
    }
  }
};

@Injectable()
export class JobService {
  constructor(
    private readonly config: ConfigService,
    private readonly jobRepository: JobRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(JobService.name);
  }

  /**
   * Start consuming, if this process is supposed to.
   *
   * Called from `AppModule` after handler discovery. A process without the `jobs` role still
   * produces jobs and still serves the admin endpoints; it simply never fetches.
   */
  async init(): Promise<void> {
    if (!this.config.hasWorker(WorkerType.JOBS)) {
      this.logger.log("Worker role 'jobs' is disabled; not consuming jobs in this process");
      return;
    }

    await this.jobRepository.startWorkers((item) => this.onJobRun(item));
    this.logger.log(`Consuming queues: ${Object.values(QueueName).join(', ')}`);
  }

  create(name: ManualJobName): Promise<void> {
    return this.jobRepository.queue(asJobItem(name));
  }

  async getAllJobStatus(): Promise<AllJobStatusResponse> {
    const queues = Object.values(QueueName);
    const reports = await Promise.all(queues.map((queue) => this.getJobStatus(queue)));

    return Object.fromEntries(queues.map((queue, index) => [queue, reports[index]])) as AllJobStatusResponse;
  }

  async handleCommand(queue: QueueName, command: QueueCommand): Promise<QueueStatusReport> {
    switch (command) {
      case QueueCommand.Pause: {
        await this.jobRepository.pause(queue);
        break;
      }

      case QueueCommand.Resume: {
        await this.jobRepository.resume(queue);
        break;
      }

      case QueueCommand.Empty: {
        await this.jobRepository.empty(queue);
        break;
      }

      case QueueCommand.ClearFailed: {
        await this.jobRepository.clearFailed(queue);
        break;
      }

      default: {
        throw new BadRequestException(`Invalid queue command: ${String(command)}`);
      }
    }

    return this.getJobStatus(queue);
  }

  private async getJobStatus(queue: QueueName): Promise<QueueStatusReport> {
    return {
      jobCounts: await this.jobRepository.getJobCounts(queue),
      queueStatus: { paused: this.jobRepository.isPaused(queue) },
    };
  }

  /**
   * The single point every job passes through.
   *
   * Two failure modes, deliberately handled differently:
   *
   *   - A handler that *returns* `JobStatus.Failed` has decided the work cannot succeed. The
   *     job is recorded as complete, because retrying a file that will never parse is just a
   *     slower way to reach the same answer.
   *   - A handler that *throws* hit something unexpected — a closed connection, a full disk.
   *     The error is re-raised so pg-boss retries with exponential backoff and, once the
   *     attempts are spent, moves the job to the queue's dead letter queue where it can be
   *     inspected and redriven rather than silently lost.
   *
   * This is the one place that difference is decided, so no handler has to know about retries.
   */
  private async onJobRun(item: JobItem): Promise<void> {
    const startedAt = Date.now();

    let status: JobStatus;
    try {
      status = await this.jobRepository.run(item);
    } catch (error) {
      this.logger.error(`Job ${item.name} threw after ${Date.now() - startedAt}ms: ${asErrorMessage(error)}`);
      throw error;
    }

    const duration = Date.now() - startedAt;

    if (status === JobStatus.Failed) {
      this.logger.warn(`Job ${item.name} failed after ${duration}ms and will not be retried`);
      return;
    }

    this.logger.debug(`Job ${item.name} ${status} in ${duration}ms`);
  }
}
