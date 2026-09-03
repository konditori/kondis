import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';

import { ConfigRepository } from 'src/repositories/config.repository';
import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName, WorkerType } from 'src/enum';
import { EventRepository } from 'src/repositories/event.repository';
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
    private readonly config: ConfigRepository,
    private readonly jobRepository: JobRepository,
    private readonly events: EventRepository,
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

  async create(name: ManualJobName): Promise<void> {
    await this.jobRepository.queue(asJobItem(name));
    await this.events.emit('JobUpdated');
  }

  async getJobHistory(limit: number, offset = 0) {
    return this.jobRepository.getJobHistory(limit, offset);
  }

  async getAllJobStatus(): Promise<AllJobStatusResponse> {
    const queues = Object.values(QueueName);
    const counts = await this.jobRepository.getAllJobCounts();

    return Object.fromEntries(
      queues.map((queue) => [
        queue,
        { jobCounts: counts[queue], queueStatus: { paused: this.jobRepository.isPaused(queue) } },
      ]),
    ) as AllJobStatusResponse;
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

    const status = await this.getJobStatus(queue);
    await this.events.emit('JobUpdated');
    return status;
  }

  private async getJobStatus(queue: QueueName): Promise<QueueStatusReport> {
    return {
      jobCounts: await this.jobRepository.getJobCounts(queue),
      queueStatus: { paused: this.jobRepository.isPaused(queue) },
    };
  }

  private async onJobRun(item: JobItem): Promise<JobStatus> {
    await this.events.emit('JobUpdated');
    const startedAt = Date.now();

    let status: JobStatus;
    try {
      status = await this.jobRepository.run(item);
    } catch (error) {
      this.logger.error(`Job ${item.name} threw after ${Date.now() - startedAt}ms: ${asErrorMessage(error)}`);
      throw error;
    } finally {
      await this.events.emit('JobUpdated');
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
