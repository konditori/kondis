import { JobHandlers, JobItem } from 'src/jobs/job.types';

/**
 * Queue abstraction. Services inject this token and never reference a queue implementation,
 * so swapping the in-process runner for pg-boss is a provider change in `app.module.ts`
 * rather than a refactor of every producer.
 */
export interface IJobRepository {
  /** Enqueue a job. Resolves once the job is accepted, not once it has run. */
  queue(item: JobItem): Promise<void>;

  /**
   * Register handlers and begin consuming. Called once at bootstrap by `JobService`, and only
   * when the `jobs` worker role is active.
   *
   * Handlers are passed in rather than imported so this layer never depends on them.
   */
  startWorkers(handlers: JobHandlers): Promise<void>;

  /** Wait for in-flight work to finish. Used by graceful shutdown and by tests. */
  drain(): Promise<void>;
}

export const JOB_REPOSITORY = Symbol('JOB_REPOSITORY');
