import { JobName, QueueName } from 'src/enum';

export type UploadedFitFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

export type UploadStatus = 'pending' | 'parsed' | 'failed';

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

export type ParsedStream = {
  type: StreamType;
  data: number[];
};

export type ParsedLap = {
  index: number;
  startedAt: Date | null;
  elapsedTimeS: number | null;
  movingTimeS: number | null;
  distanceM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPower: number | null;
  avgSpeedMps: number | null;
};

/** A decoded FIT file, before it becomes database rows. */
export type ParsedActivity = {
  sport: string;
  subSport: string | null;
  name: string | null;
  startedAt: Date;
  timezoneOffsetMinutes: number | null;
  elapsedTimeS: number;
  movingTimeS: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  avgSpeedMps: number | null;
  maxSpeedMps: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
  maxCadence: number | null;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  calories: number | null;
  streams: ParsedStream[];
  laps: ParsedLap[];
};

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
