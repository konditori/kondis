import { JobName, QueueName } from 'src/enum';
import type { ActivityTag, ActivityType } from 'src/types';

export interface IBaseJob {
  force?: boolean;
}

export interface IEntityJob extends IBaseJob {
  id: string;
}

export interface IActivityUploadJob {
  userId?: string;
  originalName: string;
  storagePath: string;
  checksum?: string;
  activityName?: string;
  activityDescription?: string;
  activitySport?: ActivityType;
  activityTags?: ActivityTag[];
  takeoutImportId?: string;
  images?: IActivityImageStage[];
}

export interface IActivityImageStage {
  originalName: string;
  storagePath: string;
  checksum: string;
  caption?: string;
  sortOrder: number;
}

export interface IActivityParseJob extends IEntityJob {
  activityName?: string;
  activityDescription?: string;
  activitySport?: ActivityType;
  activityTags?: ActivityTag[];
  takeoutImportId?: string;
  images?: IActivityImageStage[];
}

export interface IManualActivityJob extends IEntityJob {
  userId?: string;
  sourceId?: string;
  activityName?: string;
  activityDescription?: string;
  activitySport: ActivityType;
  activityTags?: ActivityTag[];
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
  takeoutImportId?: string;
  images?: IActivityImageStage[];
}

export interface ILagomTakeoutImportJob {
  userId?: string;
  originalName: string;
  storagePath: string;
  takeoutImportId?: string;
}

export interface IActivityImageIngestJob {
  imageId: string;
  uploadId: string;
  storagePath: string;
  originalName: string;
  checksum: string;
}

export interface IActivityImageAttachJob {
  uploadId: string;
  images: IActivityImageStage[];
}

export interface IUserAvatarUploadJob {
  userId: string;
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
  | { name: JobName.ActivityImageIngest; data: IActivityImageIngestJob }
  | { name: JobName.ActivityImageAttach; data: IActivityImageAttachJob }
  | { name: JobName.ActivityImageGenerateThumbnails; data: IEntityJob }
  | { name: JobName.ActivityImageGenerateQueueAll; data: IBaseJob }
  | { name: JobName.LagomTakeoutImport; data: ILagomTakeoutImportJob }
  | { name: JobName.UserAvatarUpload; data: IUserAvatarUploadJob }
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

export type JobHistoryStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface JobHistoryEntry {
  id: string;
  name: string;
  queue: QueueName;
  status: JobHistoryStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  attempt: number;
  error: string | null;
}

export interface JobHistoryResponse {
  jobs: JobHistoryEntry[];
}
