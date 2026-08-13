/**
 * Kondis API
 * 0.0.0
 * DO NOT MODIFY - This file has been generated using oazapfts.
 * See https://www.npmjs.com/package/oazapfts
 */
import * as Oazapfts from '@oazapfts/runtime';
import * as QS from '@oazapfts/runtime/query';
export const defaults: Oazapfts.Defaults<Oazapfts.CustomHeaders> = {
  headers: {},
  baseUrl: '/',
};
const oazapfts = Oazapfts.runtime(defaults);
export const servers = {};
export type PingResponseDtoOutput = {
  /** Health status of the API */
  status: string;
};
export type FitUploadResponseDtoOutput = {
  /** Uploaded activity file size in bytes */
  byteSize: number;
  /** True when activity processing was submitted to the queue */
  queued: true;
};
export type LagomTakeoutUploadResponseDtoOutput = {
  /** Uploaded takeout size in bytes */
  byteSize: number;
  /** True when the takeout import was submitted to the queue */
  queued: true;
};
export type JobCountsDtoOutput = {
  /** Jobs currently executing */
  active: number;
  /** Jobs waiting, including ones deferred to a future time */
  queued: number;
  /** Jobs scheduled to start later and not yet runnable */
  deferred: number;
  /** Jobs runnable right now: the true backlog */
  ready: number;
  /** Recent failures, including the dead letter backlog */
  failed: number;
  /** All retained jobs, including completed ones */
  total: number;
};
export type QueueStatusDtoOutput = {
  /** True when this worker has stopped consuming the queue */
  paused: boolean;
};
export type QueueStatusReportDtoOutput = {
  jobCounts: JobCountsDtoOutput;
  queueStatus: QueueStatusDtoOutput;
};
export type AllJobStatusResponseDtoOutput = {
  activityParsing: QueueStatusReportDtoOutput;
  backgroundTask: QueueStatusReportDtoOutput;
  storage: QueueStatusReportDtoOutput;
};
export type JobCreateDto = {
  /** The job to run */
  name: Name;
};
export type QueueCommandDto = {
  /** Operation to perform on the queue */
  command: Command;
};
export type ActivityMetricDtoOutput = {
  /** Elapsed duration in seconds */
  elapsedTime: number;
  /** Moving duration in seconds */
  movingTime: number | null;
  /** Distance in meters */
  distance: number | null;
  /** Total elevation gain in meters */
  elevationGain: number | null;
  /** Total elevation loss in meters */
  elevationLoss: number | null;
  /** Average speed in meters per second */
  avgSpeed: number | null;
  /** Peak speed in meters per second */
  maxSpeed: number | null;
  /** Average heart rate in bpm */
  avgHr: number | null;
  /** Maximum heart rate in bpm */
  maxHr: number | null;
  /** Average cadence in rpm */
  avgCadence: number | null;
  /** Maximum cadence in rpm */
  maxCadence: number | null;
  /** Average power in watts */
  avgPower: number | null;
  /** Maximum power in watts */
  maxPower: number | null;
  /** Normalized power in watts */
  normalizedPower: number | null;
  /** Calories in kcal */
  calories: number | null;
};
export type ActivityListResponseDtoOutput = {
  activities: {
    /** Activity id */
    id: string;
    /** Source upload id */
    uploadId: string;
    sport: ActivityType_Output;
    /** Activity name */
    name: string | null;
    /** Activity description */
    description: string | null;
    /** Start time in ISO-8601 format */
    startedAt: string;
    /** Minutes east of UTC */
    timezoneOffsetMinutes: number | null;
    /** Derived metrics, or null while computation is pending */
    metrics: ActivityMetricDtoOutput | null;
    /** Creation timestamp in ISO-8601 format */
    createdAt: string;
    /** Last update timestamp in ISO-8601 format */
    updatedAt: string;
    topBestEfforts:
      | {
          type: BestEffortType_Output;
          overallRank: number;
          yearRank: number;
        }[]
      | null;
    /** Simplified GPS route as GeoJSON */
    track: {
      type: Type;
      coordinates: [number, number][];
    } | null;
  }[];
  /** Cursor for the next page, or null at the end */
  nextCursor: string | null;
  /** Total number of activities */
  total: number;
};
export type ActivityTypeSettingsOutput = {
  type: ActivityType_Output;
  averageMetric: AverageMetric;
  showAveragePower: boolean;
  bestEffortGroup: BestEffortGroup;
};
export type ActivityTypeListResponseDtoOutput = ActivityTypeSettingsOutput[];
export type BestEffortListResponseDtoOutput = {
  sport: BestEffortSport_Output;
  type: BestEffortType_Output;
  valueKind: BestEffortValueKind_Output;
  higherIsBetter: boolean;
  /** Selected distance in meters, when applicable */
  distance: number | null;
  /** Selected duration in seconds, when applicable */
  duration: number | null;
  options: {
    type: BestEffortType_Output;
    valueKind: BestEffortValueKind_Output;
  }[];
  efforts: {
    activityId: string;
    activityName: string | null;
    sport: ActivityType_Output;
    startedAt: string;
    elapsedTime: number;
    value: number;
    overallRank: number;
    year: number;
    yearRank: number;
  }[];
};
export type ActivityDetailDtoOutput = {
  /** Activity id */
  id: string;
  /** Source upload id */
  uploadId: string;
  sport: ActivityType_Output;
  /** Activity name */
  name: string | null;
  /** Activity description */
  description: string | null;
  /** Start time in ISO-8601 format */
  startedAt: string;
  /** Minutes east of UTC */
  timezoneOffsetMinutes: number | null;
  /** Derived metrics, or null while computation is pending */
  metrics: ActivityMetricDtoOutput | null;
  /** Creation timestamp in ISO-8601 format */
  createdAt: string;
  /** Last update timestamp in ISO-8601 format */
  updatedAt: string;
  /** GPS route as GeoJSON */
  track: {
    type: Type;
    coordinates: [number, number][];
  } | null;
  bestEfforts:
    | {
        type: BestEffortType_Output;
        /** Standard effort distance in meters */
        distance: number;
        /** Effort duration in seconds */
        elapsedTime: number;
        /** Start offset from activity start in seconds */
        startTime: number;
        /** End offset from activity start in seconds */
        endTime: number;
        /** Average heart rate during the effort */
        avgHr: number | null;
        /** Net elevation change during the effort in meters */
        elevationChange: number | null;
        /** Rank among all matching efforts */
        overallRank: number;
        /** Local calendar year of the activity */
        year: number;
        /** Rank among matching efforts in that calendar year */
        yearRank: number;
      }[]
    | null;
  /** Activities matched to the same GPS route, or null while matching is pending */
  matchedRouteCount: number | null;
};
export type ActivityUpdateDto = {
  /** Display name for the activity */
  name?: string | null;
  /** Description for the activity */
  description?: string | null;
  sport?: ActivityUpdateDtoActivityType;
  /** Updated start time in ISO-8601 format */
  startedAt?: string;
};
export type ActivityDtoOutput = {
  /** Activity id */
  id: string;
  /** Source upload id */
  uploadId: string;
  sport: ActivityType_Output;
  /** Activity name */
  name: string | null;
  /** Activity description */
  description: string | null;
  /** Start time in ISO-8601 format */
  startedAt: string;
  /** Minutes east of UTC */
  timezoneOffsetMinutes: number | null;
  /** Derived metrics, or null while computation is pending */
  metrics: ActivityMetricDtoOutput | null;
  /** Creation timestamp in ISO-8601 format */
  createdAt: string;
  /** Last update timestamp in ISO-8601 format */
  updatedAt: string;
};
export type MatchedRouteListResponseDtoOutput = {
  sourceActivityId: string;
  activities: ActivityDtoOutput[] | null;
};
/**
 * Health check endpoint
 */
export function serverControllerPing(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: PingResponseDtoOutput;
    }>('/ping', {
      ...opts,
    }),
  );
}
/**
 * Upload a FIT, TCX, or GPX activity file
 */
export function uploadControllerUploadActivity(
  {
    body,
  }: {
    body: {
      /** .fit, .tcx, or .gpx activity file */
      file: Blob;
    };
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: FitUploadResponseDtoOutput;
    }>(
      '/upload/activity',
      oazapfts.multipart({
        ...opts,
        method: 'POST',
        body,
      }),
    ),
  );
}
/**
 * Import activities from a Strava takeout ZIP archive
 */
export function uploadControllerUploadStravaTakeout(
  {
    body,
  }: {
    body: {
      /** Strava takeout .zip file */
      file: Blob;
    };
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: LagomTakeoutUploadResponseDtoOutput;
    }>(
      '/upload/strava',
      oazapfts.multipart({
        ...opts,
        method: 'POST',
        body,
      }),
    ),
  );
}
/**
 * Queue depths and worker status
 */
export function jobControllerGetAllJobStatus(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: AllJobStatusResponseDtoOutput;
    }>('/jobs', {
      ...opts,
    }),
  );
}
/**
 * Run a job by hand
 */
export function jobControllerCreateJob(
  {
    jobCreateDto,
  }: {
    jobCreateDto: JobCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(
      '/jobs',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: jobCreateDto,
      }),
    ),
  );
}
/**
 * Control a queue
 */
export function jobControllerRunQueueCommand(
  {
    name,
    queueCommandDto,
  }: {
    name: QueueName;
    queueCommandDto: QueueCommandDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: QueueStatusReportDtoOutput;
    }>(
      `/jobs/${encodeURIComponent(name)}`,
      oazapfts.json({
        ...opts,
        method: 'PUT',
        body: queueCommandDto,
      }),
    ),
  );
}
/**
 * List recent activities
 */
export function activityControllerListRecent(
  {
    cursor,
    limit,
    search,
  }: {
    cursor?: string;
    limit?: number;
    search?: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ActivityListResponseDtoOutput;
    }>(
      `/activities${QS.query(
        QS.explode({
          cursor,
          limit,
          search,
        }),
      )}`,
      {
        ...opts,
      },
    ),
  );
}
/**
 * List activity types and their behavior
 */
export function activityControllerListTypes(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ActivityTypeListResponseDtoOutput;
    }>('/activities/types', {
      ...opts,
    }),
  );
}
/**
 * List best efforts over time for a sport
 */
export function activityControllerListBestEfforts(
  {
    sport,
    $type,
  }: {
    sport: BestEffortSport;
    $type: BestEffortType;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: BestEffortListResponseDtoOutput;
    }>(`/activities/best-efforts/${encodeURIComponent(sport)}/${encodeURIComponent($type)}`, {
      ...opts,
    }),
  );
}
/**
 * Get one activity and its route
 */
export function activityControllerGetById(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ActivityDetailDtoOutput;
    }>(`/activities/${encodeURIComponent(id)}`, {
      ...opts,
    }),
  );
}
/**
 * Update one activity
 */
export function activityControllerUpdateById(
  {
    id,
    activityUpdateDto,
  }: {
    id: string;
    activityUpdateDto: ActivityUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ActivityDtoOutput;
    }>(
      `/activities/${encodeURIComponent(id)}`,
      oazapfts.json({
        ...opts,
        method: 'PUT',
        body: activityUpdateDto,
      }),
    ),
  );
}
/**
 * Delete one activity
 */
export function activityControllerDeleteById(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/activities/${encodeURIComponent(id)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
/**
 * List activities matched to the same GPS route
 */
export function activityControllerListMatchedRoutes(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: MatchedRouteListResponseDtoOutput;
    }>(`/activities/${encodeURIComponent(id)}/matched-routes`, {
      ...opts,
    }),
  );
}
export enum Name {
  ReparseFailedUploads = 'reparse-failed-uploads',
  ReparseAllUploads = 'reparse-all-uploads',
}
export enum QueueName {
  ActivityParsing = 'activityParsing',
  BackgroundTask = 'backgroundTask',
  Storage = 'storage',
}
export enum Command {
  Pause = 'pause',
  Resume = 'resume',
  Empty = 'empty',
  ClearFailed = 'clear-failed',
}
export enum ActivityType_Output {
  AlpineSki = 'alpine_ski',
  BackcountrySki = 'backcountry_ski',
  Badminton = 'badminton',
  Basketball = 'basketball',
  Canoeing = 'canoeing',
  Cricket = 'cricket',
  CrossCountrySki = 'cross_country_ski',
  Crossfit = 'crossfit',
  Dance = 'dance',
  EBikeRide = 'e_bike_ride',
  Elliptical = 'elliptical',
  EMountainBikeRide = 'e_mountain_bike_ride',
  Golf = 'golf',
  GravelRide = 'gravel_ride',
  Handcycle = 'handcycle',
  HighIntensityIntervalTraining = 'high_intensity_interval_training',
  Hike = 'hike',
  IceSkate = 'ice_skate',
  InlineSkate = 'inline_skate',
  Kayaking = 'kayaking',
  Kitesurf = 'kitesurf',
  MountainBikeRide = 'mountain_bike_ride',
  Padel = 'padel',
  PhysicalTherapy = 'physical_therapy',
  Pickleball = 'pickleball',
  Pilates = 'pilates',
  Racquetball = 'racquetball',
  Ride = 'ride',
  RockClimbing = 'rock_climbing',
  RollerSki = 'roller_ski',
  Rowing = 'rowing',
  Run = 'run',
  Sail = 'sail',
  Skateboard = 'skateboard',
  Snowboard = 'snowboard',
  Snowshoe = 'snowshoe',
  Soccer = 'soccer',
  Squash = 'squash',
  StairStepper = 'stair_stepper',
  StandUpPaddling = 'stand_up_paddling',
  Surfing = 'surfing',
  Swim = 'swim',
  TableTennis = 'table_tennis',
  Tennis = 'tennis',
  TrailRun = 'trail_run',
  Velomobile = 'velomobile',
  VirtualRide = 'virtual_ride',
  VirtualRow = 'virtual_row',
  VirtualRun = 'virtual_run',
  Volleyball = 'volleyball',
  Walk = 'walk',
  WeightTraining = 'weight_training',
  Wheelchair = 'wheelchair',
  Windsurf = 'windsurf',
  Workout = 'workout',
  Yoga = 'yoga',
  Other = 'other',
}
export enum BestEffortType_Output {
  $400M = '400m',
  $1K = '1k',
  HalfMile = 'half_mile',
  $1Mile = '1_mile',
  $2Miles = '2_miles',
  $5K = '5k',
  $10K = '10k',
  $15K = '15k',
  $10Miles = '10_miles',
  $20K = '20k',
  HalfMarathon = 'half_marathon',
  $30K = '30k',
  Marathon = 'marathon',
  $50K = '50k',
  LongestRide = 'longest_ride',
  BiggestClimb = 'biggest_climb',
  ElevationGain = 'elevation_gain',
  $5Miles = '5_miles',
  $40K = '40k',
  $80K = '80k',
  $50Miles = '50_miles',
  $90K = '90k',
  $100K = '100k',
  $100Miles = '100_miles',
  $180K = '180k',
  Power5S = 'power_5s',
  Power15S = 'power_15s',
  Power30S = 'power_30s',
  Power1M = 'power_1m',
  Power2M = 'power_2m',
  Power3M = 'power_3m',
  Power5M = 'power_5m',
  Power8M = 'power_8m',
  Power10M = 'power_10m',
  Power15M = 'power_15m',
  Power20M = 'power_20m',
  Power30M = 'power_30m',
  Power45M = 'power_45m',
  Power1H = 'power_1h',
  Power2H = 'power_2h',
}
export enum Type {
  LineString = 'LineString',
}
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
export enum BestEffortSport {
  Run = 'run',
  Ride = 'ride',
}
export enum BestEffortType {
  $400M = '400m',
  $1K = '1k',
  HalfMile = 'half_mile',
  $1Mile = '1_mile',
  $2Miles = '2_miles',
  $5K = '5k',
  $10K = '10k',
  $15K = '15k',
  $10Miles = '10_miles',
  $20K = '20k',
  HalfMarathon = 'half_marathon',
  $30K = '30k',
  Marathon = 'marathon',
  $50K = '50k',
  LongestRide = 'longest_ride',
  BiggestClimb = 'biggest_climb',
  ElevationGain = 'elevation_gain',
  $5Miles = '5_miles',
  $40K = '40k',
  $80K = '80k',
  $50Miles = '50_miles',
  $90K = '90k',
  $100K = '100k',
  $100Miles = '100_miles',
  $180K = '180k',
  Power5S = 'power_5s',
  Power15S = 'power_15s',
  Power30S = 'power_30s',
  Power1M = 'power_1m',
  Power2M = 'power_2m',
  Power3M = 'power_3m',
  Power5M = 'power_5m',
  Power8M = 'power_8m',
  Power10M = 'power_10m',
  Power15M = 'power_15m',
  Power20M = 'power_20m',
  Power30M = 'power_30m',
  Power45M = 'power_45m',
  Power1H = 'power_1h',
  Power2H = 'power_2h',
}
export enum BestEffortSport_Output {
  Run = 'run',
  Ride = 'ride',
}
export enum BestEffortValueKind_Output {
  Duration = 'duration',
  Distance = 'distance',
  Elevation = 'elevation',
  Power = 'power',
}
export enum ActivityUpdateDtoActivityType {
  AlpineSki = 'alpine_ski',
  BackcountrySki = 'backcountry_ski',
  Badminton = 'badminton',
  Basketball = 'basketball',
  Canoeing = 'canoeing',
  Cricket = 'cricket',
  CrossCountrySki = 'cross_country_ski',
  Crossfit = 'crossfit',
  Dance = 'dance',
  EBikeRide = 'e_bike_ride',
  Elliptical = 'elliptical',
  EMountainBikeRide = 'e_mountain_bike_ride',
  Golf = 'golf',
  GravelRide = 'gravel_ride',
  Handcycle = 'handcycle',
  HighIntensityIntervalTraining = 'high_intensity_interval_training',
  Hike = 'hike',
  IceSkate = 'ice_skate',
  InlineSkate = 'inline_skate',
  Kayaking = 'kayaking',
  Kitesurf = 'kitesurf',
  MountainBikeRide = 'mountain_bike_ride',
  Padel = 'padel',
  PhysicalTherapy = 'physical_therapy',
  Pickleball = 'pickleball',
  Pilates = 'pilates',
  Racquetball = 'racquetball',
  Ride = 'ride',
  RockClimbing = 'rock_climbing',
  RollerSki = 'roller_ski',
  Rowing = 'rowing',
  Run = 'run',
  Sail = 'sail',
  Skateboard = 'skateboard',
  Snowboard = 'snowboard',
  Snowshoe = 'snowshoe',
  Soccer = 'soccer',
  Squash = 'squash',
  StairStepper = 'stair_stepper',
  StandUpPaddling = 'stand_up_paddling',
  Surfing = 'surfing',
  Swim = 'swim',
  TableTennis = 'table_tennis',
  Tennis = 'tennis',
  TrailRun = 'trail_run',
  Velomobile = 'velomobile',
  VirtualRide = 'virtual_ride',
  VirtualRow = 'virtual_row',
  VirtualRun = 'virtual_run',
  Volleyball = 'volleyball',
  Walk = 'walk',
  WeightTraining = 'weight_training',
  Wheelchair = 'wheelchair',
  Windsurf = 'windsurf',
  Workout = 'workout',
  Yoga = 'yoga',
  Other = 'other',
}
