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
export type ActivityDtoOutput = {
  /** Activity id */
  id: string;
  /** Source upload id */
  uploadId: string;
  /** Activity sport type */
  sport: Sport;
  /** Activity name */
  name: string | null;
  /** Start time in ISO-8601 format */
  startedAt: string;
  /** Minutes east of UTC */
  timezoneOffsetMinutes: number | null;
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
  /** Creation timestamp in ISO-8601 format */
  createdAt: string;
  /** Last update timestamp in ISO-8601 format */
  updatedAt: string;
};
export type ActivityListResponseDtoOutput = {
  activities: ActivityDtoOutput[];
  /** Cursor for the next page, or null at the end */
  nextCursor: string | null;
  /** Total number of activities */
  total: number;
};
export type ActivityDetailDtoOutput = {
  /** Activity id */
  id: string;
  /** Source upload id */
  uploadId: string;
  /** Activity sport type */
  sport: Sport;
  /** Activity name */
  name: string | null;
  /** Start time in ISO-8601 format */
  startedAt: string;
  /** Minutes east of UTC */
  timezoneOffsetMinutes: number | null;
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
  /** Creation timestamp in ISO-8601 format */
  createdAt: string;
  /** Last update timestamp in ISO-8601 format */
  updatedAt: string;
  /** Simplified GPS route as GeoJSON */
  track: {
    type: Type;
    coordinates: [number, number][];
  } | null;
  bestEfforts: {
    type: Type2;
    label: string;
    /** Standard effort distance in meters */
    distance: number;
    /** Effort duration in seconds */
    elapsedTime: number;
    /** Start offset from activity start in seconds */
    startTime: number;
    /** End offset from activity start in seconds */
    endTime: number;
  }[];
};
export type ActivityUpdateDto = {
  /** Display name for the activity */
  name?: string | null;
  /** Activity sport type */
  sport?: Sport;
  /** Updated start time in ISO-8601 format */
  startedAt?: string;
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
  }: {
    cursor?: string;
    limit?: number;
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
        }),
      )}`,
      {
        ...opts,
      },
    ),
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
export enum Sport {
  Run = 'run',
  Ride = 'ride',
  TrailRun = 'trail_run',
  Walk = 'walk',
  Swim = 'swim',
  AlpineSki = 'alpine_ski',
  RollerSki = 'roller_ski',
  CrossCountrySki = 'cross_country_ski',
  Other = 'other',
}
export enum Type {
  LineString = 'LineString',
}
export enum Type2 {
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
}
