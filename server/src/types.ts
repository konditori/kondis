import type { Kysely, Transaction } from 'kysely';
import type { Activity, ActivityMetric, ActivityUpdate, DB, NewActivity, NewLap } from 'src/db/schema';

export type KondisDatabase = Kysely<DB>;
export type KondisTransaction = Transaction<DB>;
export type KondisExecutor = KondisDatabase | KondisTransaction;

export type UploadPageOptions = {
  force: boolean;
  after?: string;
  limit: number;
};

export type ManualActivitySignature = {
  startedAt: Date;
  sport: ActivityType;
  elapsedTime: number;
};

export type MaybeArray<T> = T | T[] | undefined;

export type TcxTrackpoint = {
  Time?: string;
  Position?: {
    LatitudeDegrees?: number | string;
    LongitudeDegrees?: number | string;
  };
  AltitudeMeters?: number | string;
  DistanceMeters?: number | string;
  HeartRateBpm?: {
    Value?: number | string;
  };
  Cadence?: number | string;
  Extensions?: Record<string, unknown>;
};

export type TcxTrack = {
  Trackpoint?: MaybeArray<TcxTrackpoint>;
};

export type TcxLap = {
  StartTime?: string;
  TotalTimeSeconds?: number | string;
  DistanceMeters?: number | string;
  Calories?: number | string;
  AverageHeartRateBpm?: { Value?: number | string };
  MaximumHeartRateBpm?: { Value?: number | string };
  Cadence?: number | string;
  Track?: MaybeArray<TcxTrack>;
};

export type TcxActivity = {
  Sport?: string;
  Id?: string;
  Lap?: MaybeArray<TcxLap>;
};

export type GpxPoint = {
  lat?: number | string;
  lon?: number | string;
  ele?: number | string;
  time?: string;
  Extensions?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
};

export type GpxTrackSegment = {
  trkpt?: MaybeArray<GpxPoint>;
};

export type GpxTrack = {
  name?: string;
  type?: string;
  trkseg?: MaybeArray<GpxTrackSegment>;
  trkpt?: MaybeArray<GpxPoint>;
};

export type GpxRoute = {
  name?: string;
  type?: string;
  rtept?: MaybeArray<GpxPoint>;
};

export type GpxMetadata = {
  time?: string;
  type?: string;
  name?: string;
};

export type GpxDocument = {
  metadata?: GpxMetadata;
  trk?: MaybeArray<GpxTrack>;
  rte?: MaybeArray<GpxRoute>;
};

export type ParsedPoint = {
  record: FitRecordMesg;
  timestamp?: Date;
  lat?: number;
  lon?: number;
};

export type ParsedSegment = {
  points: ParsedPoint[];
  label?: string;
  startTime?: Date;
  totalElapsedTime?: number;
  totalDistance?: number;
};

export type GpxSegment = {
  points: GpxPoint[];
  label?: string;
};

export type FitRecordMesg = {
  timestamp?: Date | number;
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

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export type EnvData = {
  setupToken?: string;
  trustProxyHeaders: boolean;
  port: number;
  listenAddress: string;
  storageDir: string;
  database: DatabaseConfig;
  registrationEnabled: boolean;
};

export enum AverageMetric {
  None = 'none',
  Pace = 'pace',
  SwimPace = 'swim_pace',
  Speed = 'speed',
}

export type ActivityTag = (typeof import('src/constants').ACTIVITY_TAG_IDS)[number];

export type ActivityTagSettings = {
  tag: ActivityTag;
  label: string;
  sports: readonly string[] | 'all';
};

export enum BestEffortGroup {
  None = 'none',
  Run = 'run',
  Ride = 'ride',
}

export type ActivityTypeSettings = {
  type: string;
  aliases: readonly string[];
  averageMetric: AverageMetric;
  showAveragePower: boolean;
  bestEffortGroup: BestEffortGroup;
};

export type ActivityType = (typeof import('src/constants').ACTIVITY_TYPES)[number]['type'];
export type RunBestEffortType = (typeof import('src/constants').RUNNING_BEST_EFFORTS)[number]['type'];
export type CyclingBestEffortType = (typeof import('src/constants').CYCLING_BEST_EFFORTS)[number]['type'];
export type BestEffortType = RunBestEffortType | CyclingBestEffortType;
export type BestEffortValueKind = 'duration' | 'distance' | 'elevation' | 'power';
export type DistanceBestEffortDefinition = { type: BestEffortType; distance: number };

export type BestEffort = {
  type: BestEffortType;
  distance: number;
  elapsedTime: number;
  startTime: number;
  endTime: number;
  value: number;
  valueKind: BestEffortValueKind;
};

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

export type ParsedActivityStructure = {
  sport: ActivityType;
  name: string | null;
  startedAt: Date;
  timezoneOffset: number | null; // minutes east of UTC
  streams: ParsedStream[]; // index-aligned streams of samples
  laps: ParsedLap[]; // lap summaries, if any
};

export type ParsedActivity = ParsedActivityStructure & {
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
};

export type ActivityStreamInput = { type: StreamType; data: number[] };

export type CreateActivityInput = {
  activity: Omit<NewActivity, 'detail_track' | 'track'>;
  streams: ActivityStreamInput[];
  laps: Omit<NewLap, 'activity_id' | 'id'>[];
};

export type ActivityMetrics = Omit<ActivityMetric, 'activity_id'>;
export type ActivityRecord = Omit<Activity, 'detail_track' | 'route_embedding' | 'track'> & {
  metrics: ActivityMetrics | null;
};
export type ActivityListRecord = ActivityRecord & { track_geojson: string | null };

export type UpdateActivityInput = Pick<
  ActivityUpdate,
  'name' | 'description' | 'sport' | 'started_at' | 'exclude_from_rankings' | 'tags'
>;
