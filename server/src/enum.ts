export enum ActivityType {
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

export enum UploadKind {
  Activity = 'activity',
  TakeoutActivity = 'takeoutActivity',
  TakeoutPhoto = 'takeoutPhoto',
  Avatar = 'avatar',
  Image = 'image',
}

export enum ImportProgressStatus {
  Scanning = 'scanning',
  Uploading = 'uploading',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

export enum TakeoutImportItemKind {
  Activity = 'activity',
  Manual = 'manual',
}

export enum TakeoutImportItemStatus {
  Pending = 'pending',
  Uploading = 'uploading',
  Queued = 'queued',
  Completed = 'completed',
  Failed = 'failed',
  Duplicate = 'duplicate',
}

export enum TakeoutImportItemTerminalStatus {
  Completed = 'completed',
  Failed = 'failed',
  Duplicate = 'duplicate',
}

export enum DeployTarget {
  Local = 'local',
  Cloudflare = 'cloudflare',
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

export enum BestEffortValueKind {
  Duration = 'duration',
  Distance = 'distance',
  Elevation = 'elevation',
  Power = 'power',
}

export enum StreamType {
  Time = 'time',
  Latitude = 'latitude',
  Longitude = 'longitude',
  Altitude = 'altitude',
  Distance = 'distance',
  Speed = 'speed',
  Heartrate = 'heartrate',
  Cadence = 'cadence',
  Power = 'power',
  Temperature = 'temperature',
}

export enum UserRole {
  Admin = 'admin',
  User = 'user',
}

export enum LiveActivityStatus {
  Recording = 'recording',
  Paused = 'paused',
  Ended = 'ended',
  Discarded = 'discarded',
}

export enum LiveActivityProgressEventStatus {
  Recording = 'recording',
  Paused = 'paused',
  Ended = 'ended',
}

export enum WorkerType {
  API = 'api',
  WORKER = 'worker',
}

export enum QueueName {
  ActivityParsing = 'activityParsing',
  ActivityEnrichment = 'activityEnrichment',
  ActivityRanking = 'activityRanking',
  BackgroundTask = 'backgroundTask',
  ImageProcessing = 'imageProcessing',
  Storage = 'storage',
}

export enum JobName {
  AuthCredentialCleanup = 'AuthCredentialCleanup',
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
