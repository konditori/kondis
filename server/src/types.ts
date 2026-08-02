/**
 * Shared kernel: types with no runtime dependencies, importable from any layer.
 *
 * `domain/` may not import `db/` and vice versa, so vocabulary genuinely common to both
 * lives here rather than in either one.
 */

import { JobName, QueueName } from 'src/enum';

export type UploadedFitFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

export type UploadStatus = 'pending' | 'parsed' | 'failed';

/**
 * Per-sample series recorded during an activity.
 *
 * Position is split into `latitude` / `longitude` rather than an interleaved array so every
 * stream is a flat, equal-length numeric series.
 */
export type StreamType =
  | 'time'
  | 'latitude'
  | 'longitude'
  | 'altitude'
  | 'distance'
  | 'speed'
  | 'heartrate'
  | 'cadence'
  | 'power'
  | 'temperature';

/** Common to every job payload. `force` means "redo work that already looks done". */
export interface IBaseJob {
  force?: boolean;
}

/**
 * Where a job came from.
 *
 * The only reason this exists is priority: work someone is actively waiting on must not sit
 * behind a hundred thousand backfill jobs enqueued a second earlier.
 */
export type JobSource = 'upload' | 'backfill';

/** A job about one row. */
export interface IEntityJob extends IBaseJob {
  id: string;
  source?: JobSource;
}

/**
 * Every job that can be enqueued, as a discriminated union of name and payload.
 *
 * Payloads carry identifiers, never entities. A job may sit in the queue for hours and be
 * retried after that, so a handler must re-read current state; a serialized snapshot would be
 * stale by the time anyone looked at it. It also keeps rows small, which matters when a
 * fan-out job inserts tens of thousands of them at once.
 */
export type JobItem =
  | { name: JobName.ActivityParse; data: IEntityJob }
  | { name: JobName.ActivityParseQueueAll; data: IBaseJob }
  | { name: JobName.ActivityDelete; data: IEntityJob }
  | { name: JobName.FileDelete; data: { paths: string[] } };

/**
 * Name to payload. Indexing with a `JobName` that the union does not cover is a type error,
 * which is what makes a new `JobName` fail to compile until it has been given a payload.
 */
export type Jobs = { [K in JobItem['name']]: (JobItem & { name: K })['data'] };

/** The payload a handler for `T` receives. Use this rather than restating the shape. */
export type JobOf<T extends JobName> = Jobs[T];

/**
 * A point-in-time reading of one queue. Mirrors pg-boss's own vocabulary rather than
 * inventing a parallel one.
 */
export interface JobCounts {
  /** Currently executing. */
  active: number;
  /** Waiting, including jobs deferred to a future time. */
  queued: number;
  /** Waiting on a `startAfter` in the future, so not yet runnable. */
  deferred: number;
  /** Runnable right now: the true backlog. */
  ready: number;
  /** Recent failures still retained by the queue's retention policy. */
  failed: number;
  /** Everything the queue's tables still hold, including completed jobs pending deletion. */
  total: number;
}

export interface QueueStatus {
  /** True when this process has stopped consuming the queue. See `JobRepository.pause`. */
  paused: boolean;
}

export type QueueStatusReport = {
  jobCounts: JobCounts;
  queueStatus: QueueStatus;
};

export type AllJobStatusResponse = Record<QueueName, QueueStatusReport>;
