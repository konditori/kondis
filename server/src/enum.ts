export enum WorkerType {
  API = 'api',
  WORKER = 'worker',
}

export enum QueueName {
  ActivityParsing = 'activityParsing',
  BackgroundTask = 'backgroundTask',
  ImageProcessing = 'imageProcessing',
  Storage = 'storage',
}

export enum JobName {
  ActivityUpload = 'ActivityUpload',
  ActivityMetricCompute = 'ActivityMetricCompute',
  ActivityBestEffortCompute = 'ActivityBestEffortCompute',
  ActivityBestEffortRank = 'ActivityBestEffortRank',
  ActivityRouteMatchCompute = 'ActivityRouteMatchCompute',
  ActivityParse = 'ActivityParse',
  ActivityManualCreate = 'ActivityManualCreate',
  ActivityParseQueueAll = 'ActivityParseQueueAll',
  ActivityDelete = 'ActivityDelete',
  ActivityImageIngest = 'ActivityImageIngest',
  ActivityImageAttach = 'ActivityImageAttach',
  ActivityImageGenerateThumbnails = 'ActivityImageGenerateThumbnails',
  ActivityImageGenerateQueueAll = 'ActivityImageGenerateQueueAll',
  LagomTakeoutImport = 'LagomTakeoutImport',
  UserAvatarUpload = 'UserAvatarUpload',
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
