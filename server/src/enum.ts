/**
 * Enums shared across every layer.
 *
 * Kept free of imports so anything may depend on it, including `db/` and `domain/`.
 * String values are persisted (queue names become rows in pg-boss's queue table, job names
 * become the discriminator on every stored job), so **renaming a value is a migration, not a
 * refactor**. Renaming a member is free.
 */

/**
 * Process roles. A single container runs every role by default; `KONDIS_WORKERS` can
 * narrow it so the API and the job worker can be scaled independently without changing the
 * image or the entrypoint.
 */
export enum WorkerType {
  API = 'api',
  JOBS = 'jobs',
}

/**
 * A queue is a unit of *scheduling isolation*: one pg-boss worker pool, one concurrency
 * setting, one dead letter queue, one pause switch. Jobs are grouped by the resource they
 * contend for, not by the feature they belong to.
 *
 * Splitting on contention is what stops a thousand queued FIT parses from starving a single
 * file deletion, and it is why `deleteActivity` does not share a queue with `parseActivity`.
 */
export enum QueueName {
  /** CPU-bound: FIT decoding, stream extraction, PostGIS track construction. */
  ActivityParsing = 'activityParsing',
  /** Cheap orchestration: fan-out jobs, row deletes, anything that is mostly waiting on the database. */
  BackgroundTask = 'backgroundTask',
  /** Filesystem I/O, kept away from the CPU-bound queue so a slow disk cannot stall parsing. */
  Storage = 'storage',
}

/**
 * Every distinct unit of work. Exactly one handler services each name, enforced at startup by
 * `JobRepository.setup`, and every name must appear in the `JobItem` union, enforced by the
 * compiler.
 *
 * Names ending in `QueueAll` are fan-out jobs: they enumerate the database and enqueue one
 * job per row. They do the work of a `for` loop that would otherwise run inside an HTTP
 * request, and they are the reason a queue exists at all.
 */
export enum JobName {
  ActivityParse = 'ActivityParse',
  ActivityParseQueueAll = 'ActivityParseQueueAll',
  ActivityDelete = 'ActivityDelete',
  FileDelete = 'FileDelete',
}

/**
 * A handler's verdict.
 *
 * `Failed` is returned for an expected, non-retryable outcome ("this upload is not a valid FIT
 * file"); the job is recorded as complete and will not be retried, because retrying cannot
 * help. A *thrown* error is different: it means an unexpected fault, and pg-boss retries it
 * with backoff before dead-lettering.
 */
export enum JobStatus {
  Success = 'success',
  Failed = 'failed',
  Skipped = 'skipped',
}

/** Administrative operations on a queue, exposed over the API. */
export enum QueueCommand {
  Pause = 'pause',
  Resume = 'resume',
  /** Discard everything waiting. Does not touch jobs that are already running. */
  Empty = 'empty',
  /** Discard the dead letter backlog and any retained failures. */
  ClearFailed = 'clear-failed',
}

/**
 * The subset of jobs an operator may trigger by hand.
 *
 * Deliberately not `JobName`: most jobs take an entity id and are meaningless without one, and
 * exposing the raw job vocabulary over HTTP would freeze it into the public API.
 */
export enum ManualJobName {
  /** Retry every upload that has not yet produced an activity. */
  ReparseFailedUploads = 'reparse-failed-uploads',
  /** Re-run the parser over every upload, including ones already parsed. */
  ReparseAllUploads = 'reparse-all-uploads',
}

/** Reflect metadata keys. Namespaced so they cannot collide with framework or library keys. */
export enum MetadataKey {
  JobConfig = 'kondis:job-config',
}
