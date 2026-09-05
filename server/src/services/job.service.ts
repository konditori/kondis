import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName } from 'src/enum';
import { BadRequestException } from 'src/errors';
import { ConsoleLogger } from 'src/logger';
import type { JobAdminPort, JobConsumerPort, JobProducerPort } from 'src/ports/queue.port';
import type { RealtimePort } from 'src/ports/realtime.port';
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

export type JobQueuePorts = {
  admin: JobAdminPort;
  consumer?: JobConsumerPort;
  producer: JobProducerPort;
};

export class JobService {
  constructor(
    private readonly queues: JobQueuePorts,
    private readonly events: RealtimePort,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(JobService.name);
  }

  async init(consumeJobs: boolean): Promise<void> {
    if (!consumeJobs) {
      this.logger.log("Role 'worker' is disabled; not consuming jobs in this process");
      return;
    }
    if (!this.queues.consumer) {
      throw new Error('This composition has no job consumer');
    }

    await this.queues.consumer.startWorkers((item) => this.onJobRun(item));
    this.logger.log(`Consuming queues: ${Object.values(QueueName).join(', ')}`);
  }

  async create(name: ManualJobName): Promise<void> {
    await this.queues.producer.queue(asJobItem(name));
    await this.events.emit('JobUpdated');
  }

  async getJobHistory(limit: number, offset = 0) {
    return this.queues.admin.getJobHistory(limit, offset);
  }

  async getAllJobStatus(): Promise<AllJobStatusResponse> {
    const queues = Object.values(QueueName);
    const counts = await this.queues.admin.getAllJobCounts();

    return Object.fromEntries(
      queues.map((queue) => [
        queue,
        { jobCounts: counts[queue], queueStatus: { paused: this.queues.admin.isPaused(queue) } },
      ]),
    ) as AllJobStatusResponse;
  }

  async handleCommand(queue: QueueName, command: QueueCommand): Promise<QueueStatusReport> {
    switch (command) {
      case QueueCommand.Pause: {
        await this.queues.admin.pause(queue);
        break;
      }

      case QueueCommand.Resume: {
        await this.queues.admin.resume(queue);
        break;
      }

      case QueueCommand.Empty: {
        await this.queues.admin.empty(queue);
        break;
      }

      case QueueCommand.ClearFailed: {
        await this.queues.admin.clearFailed(queue);
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
      jobCounts: await this.queues.admin.getJobCounts(queue),
      queueStatus: { paused: this.queues.admin.isPaused(queue) },
    };
  }

  private async onJobRun(item: JobItem): Promise<JobStatus> {
    await this.events.emit('JobUpdated');
    const startedAt = Date.now();

    let status: JobStatus;
    try {
      if (!this.queues.consumer) {
        throw new Error('This composition has no job consumer');
      }
      status = await this.queues.consumer.run(item);
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
