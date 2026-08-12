export enum WorkerType {
  API = 'api',
  JOBS = 'jobs',
}

export enum QueueName {
  ActivityParsing = 'activityParsing',
  BackgroundTask = 'backgroundTask',
  Storage = 'storage',
}

export enum JobName {
  ActivityUpload = 'ActivityUpload',
  ActivityMetricCompute = 'ActivityMetricCompute',
  ActivityBestEffortCompute = 'ActivityBestEffortCompute',
  ActivityBestEffortRank = 'ActivityBestEffortRank',
  ActivityRouteMatchCompute = 'ActivityRouteMatchCompute',
  ActivityParse = 'ActivityParse',
  ActivityParseQueueAll = 'ActivityParseQueueAll',
  ActivityDelete = 'ActivityDelete',
  LagomTakeoutImport = 'LagomTakeoutImport',
  FileDelete = 'FileDelete',
  TemporaryFileCleanup = 'TemporaryFileCleanup',
}

export enum JobStatus {
  Success = 'success',
  Failed = 'failed',
  Skipped = 'skipped',
}

export enum QueueCommand {
  Pause = 'pause',
  Resume = 'resume',
  Empty = 'empty',
  ClearFailed = 'clear-failed',
}

export enum ManualJobName {
  ReparseFailedUploads = 'reparse-failed-uploads',
  ReparseAllUploads = 'reparse-all-uploads',
}

export enum MetadataKey {
  JobConfig = 'kondis:job-config',
}
