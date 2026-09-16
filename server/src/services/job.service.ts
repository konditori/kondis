import { JobName, JobStatus, ManualJobName, QueueCommand, QueueName } from 'src/enum';
import { BadRequestException } from 'src/errors';
import type { JobHandlers } from 'src/jobs/job-handler';
import { BaseService, type BaseServiceDeps } from 'src/services/base.service';
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

export class JobService extends BaseService {
  constructor(
    deps: BaseServiceDeps,
    private readonly handlers: JobHandlers = {},
  ) {
    super(deps);
  }

  hasHandler(name: JobName): boolean {
    return Boolean(this.handlers[name]);
  }

  async create(name: ManualJobName): Promise<void> {
    await this.jobRepository.queue(asJobItem(name));
    await this.eventRepository.emit('JobUpdated');
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
    await this.eventRepository.emit('JobUpdated');
    return status;
  }

  private async getJobStatus(queue: QueueName): Promise<QueueStatusReport> {
    return {
      jobCounts: await this.jobRepository.getJobCounts(queue),
      queueStatus: { paused: this.jobRepository.isPaused(queue) },
    };
  }

  async execute(item: JobItem, { notify = true }: { notify?: boolean } = {}): Promise<JobStatus> {
    if (notify) {
      await this.eventRepository.emit('JobUpdated');
    }
    const startedAt = Date.now();

    let status: JobStatus;
    try {
      const handler = this.handlers[item.name];
      if (!handler) {
        throw new Error(`No handler registered for job ${item.name}`);
      }
      status = await handler(item.data as never);
    } catch (error) {
      this.logger.error(`Job ${item.name} threw after ${Date.now() - startedAt}ms: ${asErrorMessage(error)}`);
      throw error;
    } finally {
      if (notify) {
        await this.eventRepository.emit('JobUpdated');
      }
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
