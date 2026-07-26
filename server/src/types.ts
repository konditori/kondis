/**
 * Shared kernel: primitive types with no dependencies, importable from any layer.
 *
 * `domain/` may not import `db/` and vice versa, so vocabulary genuinely common to both
 * lives here rather than in either one.
 */

export type UploadedFitFile = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

/**
 * Process roles. A single container runs every role by default; `KONDIS_WORKERS` can
 * narrow it so the API and the job worker can be scaled independently later without
 * changing the image or the entrypoint.
 */
export enum WorkerType {
  API = 'api',
  JOBS = 'jobs',
}

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
