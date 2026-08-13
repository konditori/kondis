import { JobName, QueueName } from 'src/enum';

export enum AverageMetric {
  None = 'none',
  Pace = 'pace',
  SwimPace = 'swim_pace',
  Speed = 'speed',
}

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

const defineActivityType = <const T extends string>(
  type: T,
  settings: Omit<ActivityTypeSettings, 'type' | 'aliases' | 'bestEffortGroup'> &
    Partial<Pick<ActivityTypeSettings, 'aliases' | 'bestEffortGroup'>>,
): ActivityTypeSettings & { type: T } => ({
  type,
  aliases: [],
  bestEffortGroup: BestEffortGroup.None,
  ...settings,
});

// All supported activity types with their individual quirks
export const ACTIVITY_TYPES = [
  defineActivityType('alpine_ski', {
    aliases: ['alpine_skiing', 'downhill_skiing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('backcountry_ski', { averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('badminton', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('basketball', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('canoeing', { aliases: ['canoe'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('cricket', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('cross_country_ski', {
    aliases: ['cross_country_skiing', 'nordic_ski', 'nordic_skiing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('crossfit', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('dance', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('e_bike_ride', {
    aliases: ['e_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('elliptical', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('e_mountain_bike_ride', {
    aliases: ['e_mountain_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('golf', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('gravel_ride', {
    aliases: ['gravel_cycling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('handcycle', { averageMetric: AverageMetric.Speed, showAveragePower: true }),
  defineActivityType('high_intensity_interval_training', {
    aliases: ['hiit'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('hike', {
    aliases: ['hiking'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('ice_skate', {
    aliases: ['ice_skating'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('inline_skate', { averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('kayaking', { aliases: ['kayak'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('kitesurf', { averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('mountain_bike_ride', {
    aliases: ['mountain_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('padel', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('physical_therapy', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('pickleball', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('pilates', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('racquetball', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('ride', {
    aliases: ['cycling', 'biking', 'bike'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('rock_climbing', {
    aliases: ['rock_climb'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('roller_ski', {
    aliases: ['roller_skiing'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('rowing', { aliases: ['row'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('run', {
    aliases: ['running'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
    bestEffortGroup: BestEffortGroup.Run,
  }),
  defineActivityType('sail', {
    aliases: ['sailing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('skateboard', {
    aliases: ['skateboarding'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('snowboard', {
    aliases: ['snowboarding'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('snowshoe', {
    aliases: ['snowshoeing'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('soccer', {
    aliases: ['football'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('squash', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('stair_stepper', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('stand_up_paddling', {
    aliases: ['stand_up_paddleboarding', 'standup_paddling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('surfing', { aliases: ['surf'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('swim', {
    aliases: ['swimming'],
    averageMetric: AverageMetric.SwimPace,
    showAveragePower: false,
  }),
  defineActivityType('table_tennis', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('tennis', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('trail_run', {
    aliases: ['trail_running'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
    bestEffortGroup: BestEffortGroup.Run,
  }),
  defineActivityType('velomobile', { averageMetric: AverageMetric.Speed, showAveragePower: true }),
  defineActivityType('virtual_ride', {
    aliases: ['virtual_cycling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('virtual_row', {
    aliases: ['virtual_rowing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('virtual_run', {
    aliases: ['virtual_running'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
    bestEffortGroup: BestEffortGroup.Run,
  }),
  defineActivityType('volleyball', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('walk', {
    aliases: ['walking'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('weight_training', {
    aliases: ['weight_lifting', 'weightlifting'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('wheelchair', { averageMetric: AverageMetric.Pace, showAveragePower: false }),
  defineActivityType('windsurf', {
    aliases: ['windsurfing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('workout', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('yoga', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('other', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
] as const satisfies readonly ActivityTypeSettings[];

export type ActivityType = (typeof ACTIVITY_TYPES)[number]['type'];

export const ACTIVITY_TYPE_IDS = ACTIVITY_TYPES.map(({ type }) => type) as [ActivityType, ...ActivityType[]];

export const RUNNING_BEST_EFFORTS = [
  { type: '400m', distance: 400, valueKind: 'duration', higherIsBetter: false },
  { type: '1k', distance: 1000, valueKind: 'duration', higherIsBetter: false },
  { type: 'half_mile', distance: 804.672, valueKind: 'duration', higherIsBetter: false },
  { type: '1_mile', distance: 1609.344, valueKind: 'duration', higherIsBetter: false },
  { type: '2_miles', distance: 3218.688, valueKind: 'duration', higherIsBetter: false },
  { type: '5k', distance: 5000, valueKind: 'duration', higherIsBetter: false },
  { type: '10k', distance: 10_000, valueKind: 'duration', higherIsBetter: false },
  { type: '15k', distance: 15_000, valueKind: 'duration', higherIsBetter: false },
  { type: '10_miles', distance: 16_093.44, valueKind: 'duration', higherIsBetter: false },
  { type: '20k', distance: 20_000, valueKind: 'duration', higherIsBetter: false },
  { type: 'half_marathon', distance: 21_097.5, valueKind: 'duration', higherIsBetter: false },
  { type: '30k', distance: 30_000, valueKind: 'duration', higherIsBetter: false },
  { type: 'marathon', distance: 42_195, valueKind: 'duration', higherIsBetter: false },
  { type: '50k', distance: 50_000, valueKind: 'duration', higherIsBetter: false },
] as const;

export const CYCLING_BEST_EFFORTS = [
  { type: 'longest_ride', valueKind: 'distance', higherIsBetter: true },
  { type: 'biggest_climb', valueKind: 'elevation', higherIsBetter: true },
  { type: 'elevation_gain', valueKind: 'elevation', higherIsBetter: true },
  { type: '5_miles', distance: 8046.72, valueKind: 'duration', higherIsBetter: false },
  { type: '10k', distance: 10_000, valueKind: 'duration', higherIsBetter: false },
  { type: '10_miles', distance: 16_093.44, valueKind: 'duration', higherIsBetter: false },
  { type: '20k', distance: 20_000, valueKind: 'duration', higherIsBetter: false },
  { type: '30k', distance: 30_000, valueKind: 'duration', higherIsBetter: false },
  { type: '40k', distance: 40_000, valueKind: 'duration', higherIsBetter: false },
  { type: '50k', distance: 50_000, valueKind: 'duration', higherIsBetter: false },
  { type: '80k', distance: 80_000, valueKind: 'duration', higherIsBetter: false },
  { type: '50_miles', distance: 80_467.2, valueKind: 'duration', higherIsBetter: false },
  { type: '90k', distance: 90_000, valueKind: 'duration', higherIsBetter: false },
  { type: '100k', distance: 100_000, valueKind: 'duration', higherIsBetter: false },
  { type: '100_miles', distance: 160_934.4, valueKind: 'duration', higherIsBetter: false },
  { type: '180k', distance: 180_000, valueKind: 'duration', higherIsBetter: false },
  { type: 'power_5s', duration: 5, valueKind: 'power', higherIsBetter: true },
  { type: 'power_15s', duration: 15, valueKind: 'power', higherIsBetter: true },
  { type: 'power_30s', duration: 30, valueKind: 'power', higherIsBetter: true },
  { type: 'power_1m', duration: 60, valueKind: 'power', higherIsBetter: true },
  { type: 'power_2m', duration: 120, valueKind: 'power', higherIsBetter: true },
  { type: 'power_3m', duration: 180, valueKind: 'power', higherIsBetter: true },
  { type: 'power_5m', duration: 300, valueKind: 'power', higherIsBetter: true },
  { type: 'power_8m', duration: 480, valueKind: 'power', higherIsBetter: true },
  { type: 'power_10m', duration: 600, valueKind: 'power', higherIsBetter: true },
  { type: 'power_15m', duration: 900, valueKind: 'power', higherIsBetter: true },
  { type: 'power_20m', duration: 1200, valueKind: 'power', higherIsBetter: true },
  { type: 'power_30m', duration: 1800, valueKind: 'power', higherIsBetter: true },
  { type: 'power_45m', duration: 2700, valueKind: 'power', higherIsBetter: true },
  { type: 'power_1h', duration: 3600, valueKind: 'power', higherIsBetter: true },
  { type: 'power_2h', duration: 7200, valueKind: 'power', higherIsBetter: true },
] as const;

export type RunBestEffortType = (typeof RUNNING_BEST_EFFORTS)[number]['type'];
export type CyclingBestEffortType = (typeof CYCLING_BEST_EFFORTS)[number]['type'];
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

export const BEST_EFFORT_TYPES = [
  ...new Set([...RUNNING_BEST_EFFORTS.map(({ type }) => type), ...CYCLING_BEST_EFFORTS.map(({ type }) => type)]),
] as [BestEffortType, ...BestEffortType[]];

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

export interface IBaseJob {
  force?: boolean;
}

export interface IEntityJob extends IBaseJob {
  id: string;
}

export interface IActivityUploadJob {
  originalName: string;
  storagePath: string;
  checksum: string;
  activityName?: string;
  activityDescription?: string;
  activitySport?: ActivityType;
}

export interface IActivityParseJob extends IEntityJob {
  activityName?: string;
  activityDescription?: string;
  activitySport?: ActivityType;
}

export interface IManualActivityJob extends IEntityJob {
  activityName?: string;
  activityDescription?: string;
  activitySport: ActivityType;
  startedAt: string;
  elapsedTime: number;
  movingTime?: number | null;
  distance?: number | null;
  elevationGain?: number | null;
  elevationLoss?: number | null;
  avgSpeed?: number | null;
  maxSpeed?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
}

export interface ILagomTakeoutImportJob {
  originalName: string;
  storagePath: string;
}

export type JobItem =
  | { name: JobName.ActivityUpload; data: IActivityUploadJob }
  | { name: JobName.ActivityMetricCompute; data: IEntityJob }
  | { name: JobName.ActivityBestEffortCompute; data: IEntityJob }
  | { name: JobName.ActivityBestEffortRank; data: { id?: string } }
  | { name: JobName.ActivityRouteMatchCompute; data: IEntityJob }
  | { name: JobName.ActivityParse; data: IActivityParseJob }
  | { name: JobName.ActivityManualCreate; data: IManualActivityJob }
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
