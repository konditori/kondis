import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

import { JobHandlers, JobItem } from 'src/jobs/job.types';
import { IJobRepository } from 'src/repositories/job.repository';

/**
 * In-process job runner.
 *
 * Deliberately the first implementation: it establishes the seam and the call sites without
 * adding infrastructure before the workload justifies it.
 *
 * Known limitations, and precisely why this gets replaced by pg-boss once bulk import lands:
 *   - Jobs are not durable. A restart loses anything in flight.
 *   - No retries, no backoff, no dead-letter queue.
 *   - No cross-process distribution; a job runs wherever it was created.
 *   - Enqueueing is not transactional with the database write that triggered it.
 *
 * Work is still dispatched off the caller's stack, so an HTTP request never waits on a job.
 * That keeps producer semantics identical to a real queue and means call sites will not need
 * to change when the backend does.
 */
@Injectable()
export class InProcessJobRepository implements IJobRepository, OnApplicationShutdown {
  private readonly logger = new Logger(InProcessJobRepository.name);
  private handlers: JobHandlers | null = null;
  private readonly inFlight = new Set<Promise<void>>();

  startWorkers(handlers: JobHandlers): Promise<void> {
    this.handlers = handlers;
    this.logger.log(`Registered in-process handlers: ${Object.keys(handlers).join(', ')}`);
    return Promise.resolve();
  }

  queue(item: JobItem): Promise<void> {
    const handlers = this.handlers;
    if (!handlers) {
      // A durable queue would persist this for a worker to pick up later. This one cannot,
      // so make the dropped work loud rather than silent.
      this.logger.warn(`Dropping job ${item.name}: no handlers registered. Is the 'jobs' role enabled?`);
      return Promise.resolve();
    }

    const task = this.execute(item, handlers);
    this.inFlight.add(task);
    void task.finally(() => {
      this.inFlight.delete(task);
    });

    return Promise.resolve();
  }

  async drain(): Promise<void> {
    while (this.inFlight.size > 0) {
      await Promise.all(this.inFlight);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.inFlight.size === 0) {
      return;
    }

    this.logger.log(`Waiting for ${this.inFlight.size} in-flight job(s)`);
    await this.drain();
  }

  /** Never rejects: a failing job is logged, not propagated back to whoever enqueued it. */
  private async execute(item: JobItem, handlers: JobHandlers): Promise<void> {
    // Yield first so the producer's stack unwinds before any handler work starts, matching
    // the semantics of a real out-of-process queue.
    await Promise.resolve();

    try {
      await handlers[item.name](item.data);
    } catch (error) {
      this.logger.error(`Job ${item.name} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
