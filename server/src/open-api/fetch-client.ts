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
  /** Upload id */
  id: string;
  /** Lowercase hash of file contents */
  checksum: string;
  /** Stored file size in bytes */
  byteSize: number;
  /** True when identical content was already stored */
  duplicate: boolean;
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
 * Upload a FIT activity file
 */
export function importControllerUploadFit(
  {
    body,
  }: {
    body: {
      /** .fit activity file */
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
      '/uploads/fit',
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
