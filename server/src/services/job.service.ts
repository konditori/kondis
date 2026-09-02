import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';

import { ConfigService } from 'src/config/config.service';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName, WorkerType } from 'src/enum';
import { JobRepository } from 'src/repositories/job.repository';
import { AllJobStatusResponse, JobItem, QueueStatusReport } from 'src/types/jobs';
import { asErrorMessage } from 'src/utils/misc';

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

  async init(): Promise<void> {
    if (!this.config.hasWorker(WorkerType.WORKER)) {
      this.logger.log("Role 'worker' is disabled; not consuming jobs in this process");
      return;
    }

    await this.jobRepository.startWorkers((item) => this.onJobRun(item));
    this.logger.log(`Consuming queues: ${Object.values(QueueName).join(', ')}`);
  }

  create(name: ManualJobName): Promise<void> {
    return this.jobRepository.queue(asJobItem(name));
  }

  async getJobHistory(limit: number) {
    return { jobs: await this.jobRepository.getJobHistory(limit) };
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

  private async onJobRun(item: JobItem): Promise<JobStatus> {
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
      return status;
    }

    this.logger.debug(`Job ${item.name} ${status} in ${duration}ms`);
    return status;
  }
}
