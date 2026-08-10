import { JobName, QueueName } from 'src/enum';

export type UploadedFileData = {
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

export type ParsedActivity = {
  sport: string;
  subSport: string | null;
  name: string | null;
  startedAt: Date;
  timezoneOffset: number | null; // minutes east of UTC
  elapsedTime: number; // seconds
  movingTime: number | null; // seconds
  distance: number | null; // meters
  elevationGain: number | null; // meters
  elevationLoss: number | null; // meters
  avgSpeed: number | null; // meters per second
  maxSpeed: number | null; // meters per second
  avgHr: number | null; // beats per minute
  maxHr: number | null; // beats per minute
  avgCadence: number | null; // revolutions per minute
  maxCadence: number | null; // revolutions per minute
  avgPower: number | null; // watts
  maxPower: number | null; // watts
  normalizedPower: number | null; // watts
  calories: number | null; // kilocalories
  streams: ParsedStream[]; // index-aligned streams of samples
  laps: ParsedLap[]; // lap summaries, if any
};

export interface IBaseJob {
  force?: boolean;
}

export interface IEntityJob extends IBaseJob {
  id: string;
}

export interface IFileUploadJob {
  originalName: string;
  contents: string;
}

export interface ILagomTakeoutImportJob {
  originalName: string;
  storagePath: string;
}

export type JobItem =
  | { name: JobName.ActivityUpload; data: IFileUploadJob }
  | { name: JobName.ActivityParse; data: IEntityJob }
  | { name: JobName.ActivityParseQueueAll; data: IBaseJob }
  | { name: JobName.ActivityDelete; data: IEntityJob }
  | { name: JobName.LagomTakeoutImport; data: ILagomTakeoutImportJob }
  | { name: JobName.FileDelete; data: { paths: string[] } }
  | { name: JobName.TemporaryFileCleanup; data: Record<string, never> };

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
  paused: boolean;
}

export type QueueStatusReport = {
  jobCounts: JobCounts;
  queueStatus: QueueStatus;
};

export type AllJobStatusResponse = Record<QueueName, QueueStatusReport>;
