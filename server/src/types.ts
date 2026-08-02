import { JobName, QueueName } from 'src/enum';

export type FitRecordMesg = {
  timestamp?: Date | number;
  // Semicircles on most devices. `parse-fit` normalises to degrees
  positionLat?: number;
  positionLong?: number;
  altitude?: number;
  enhancedAltitude?: number;
  distance?: number;
  speed?: number;
  enhancedSpeed?: number;
  heartRate?: number;
  cadence?: number;
  power?: number;
  temperature?: number;
};

export type FitSessionMesg = {
  sport?: string | number;
  subSport?: string | number;
  startTime?: Date | number;
  totalElapsedTime?: number;
  // FIT's "timer time", i.e. moving time with auto-pause excluded.
  totalTimerTime?: number;
  totalDistance?: number;
  totalAscent?: number;
  totalDescent?: number;
  avgSpeed?: number;
  enhancedAvgSpeed?: number;
  maxSpeed?: number;
  enhancedMaxSpeed?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgPower?: number;
  maxPower?: number;
  normalizedPower?: number;
  totalCalories?: number;
};

export type FitLapMesg = {
  startTime?: Date | number;
  totalElapsedTime?: number;
  totalTimerTime?: number;
  totalDistance?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPower?: number;
  avgSpeed?: number;
  enhancedAvgSpeed?: number;
};

export type FitMessages = {
  sessionMesgs?: FitSessionMesg[];
  recordMesgs?: FitRecordMesg[];
  lapMesgs?: FitLapMesg[];
};

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

export type JobItem =
  | { name: JobName.ActivityParse; data: IEntityJob }
  | { name: JobName.ActivityParseQueueAll; data: IBaseJob }
  | { name: JobName.ActivityDelete; data: IEntityJob }
  | { name: JobName.FileDelete; data: { paths: string[] } };

export type Jobs = { [K in JobItem['name']]: (JobItem & { name: K })['data'] };
export type JobOf<T extends JobName> = Jobs[T];

export interface JobCounts {
  active: number;
  queued: number;
  deferred: number;
  ready: number;
  failed: number;
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
