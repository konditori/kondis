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
  baseUrl: '/api/v1',
};
const oazapfts = Oazapfts.runtime(defaults);
export const servers = {
  server1: '/api/v1',
};

export enum Role {
  Admin = 'admin',
  User = 'user',
}

export enum AverageMetric {
  None = 'none',
  Pace = 'pace',
  SwimPace = 'swim_pace',
  Speed = 'speed',
}

export enum ActivityType {
  AlpineSki = 'alpine_ski', BackcountrySki = 'backcountry_ski', Badminton = 'badminton', Basketball = 'basketball', Canoeing = 'canoeing', Cricket = 'cricket', CrossCountrySki = 'cross_country_ski', Crossfit = 'crossfit', Dance = 'dance', EBikeRide = 'e_bike_ride', Elliptical = 'elliptical', EMountainBikeRide = 'e_mountain_bike_ride', Golf = 'golf', GravelRide = 'gravel_ride', Handcycle = 'handcycle', HighIntensityIntervalTraining = 'high_intensity_interval_training', Hike = 'hike', IceSkate = 'ice_skate', InlineSkate = 'inline_skate', Kayaking = 'kayaking', Kitesurf = 'kitesurf', MountainBikeRide = 'mountain_bike_ride', Padel = 'padel', PhysicalTherapy = 'physical_therapy', Pickleball = 'pickleball', Pilates = 'pilates', Racquetball = 'racquetball', Ride = 'ride', RockClimbing = 'rock_climbing', RollerSki = 'roller_ski', Rowing = 'rowing', Run = 'run', Sail = 'sail', Skateboard = 'skateboard', Snowboard = 'snowboard', Snowshoe = 'snowshoe', Soccer = 'soccer', Squash = 'squash', StairStepper = 'stair_stepper', StandUpPaddling = 'stand_up_paddling', Surfing = 'surfing', Swim = 'swim', TableTennis = 'table_tennis', Tennis = 'tennis', TrailRun = 'trail_run', Velomobile = 'velomobile', VirtualRide = 'virtual_ride', VirtualRow = 'virtual_row', VirtualRun = 'virtual_run', Volleyball = 'volleyball', Walk = 'walk', WeightTraining = 'weight_training', Wheelchair = 'wheelchair', Windsurf = 'windsurf', Workout = 'workout', Yoga = 'yoga', Other = 'other',
}
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
export type TakeoutImportCreateResponseDtoOutput = {
  importId: string;
  status: 'scanning';
};
export type TakeoutImportScanResponseDtoOutput = {
  pendingItemKeys: string[];
};
export type TakeoutItemSubmissionResponseDtoOutput = {
  accepted: boolean;
};
export type TakeoutImportStatusDtoOutput = {
  importId: string;
  status: 'scanning' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  total: number | null;
  uploaded: number;
  processed: number;
  failed: number;
  duplicates: number;
  error: string | null;
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
export type AllJobStatusResponseDtoOutput = {
  activityParsing: {
    jobCounts: JobCountsDtoOutput;
    queueStatus: QueueStatusDtoOutput;
  };
  activityEnrichment: {
    jobCounts: JobCountsDtoOutput;
    queueStatus: QueueStatusDtoOutput;
  };
  backgroundTask: {
    jobCounts: JobCountsDtoOutput;
    queueStatus: QueueStatusDtoOutput;
  };
  imageProcessing: {
    jobCounts: JobCountsDtoOutput;
    queueStatus: QueueStatusDtoOutput;
  };
  storage: {
    jobCounts: JobCountsDtoOutput;
    queueStatus: QueueStatusDtoOutput;
  };
};
export type JobCreateDto = {
  /** The job to run */
  name: 'reparse-failed-uploads' | 'reparse-all-uploads';
};
export type QueueNameOutput =
  'activityParsing' | 'activityEnrichment' | 'backgroundTask' | 'imageProcessing' | 'storage';
export type JobHistoryResponseDtoOutput = {
  jobs: {
    id: string;
    name: string;
    activityId: string | null;
    queue: QueueNameOutput;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
    attempt: number;
    error: string | null;
  }[];
  total: number;
};
export type QueueName = 'activityParsing' | 'activityEnrichment' | 'backgroundTask' | 'imageProcessing' | 'storage';
export type QueueCommandDto = {
  /** Operation to perform on the queue */
  command: 'pause' | 'resume' | 'empty' | 'clear-failed';
};
export type QueueStatusReportDtoOutput = {
  jobCounts: JobCountsDtoOutput;
  queueStatus: QueueStatusDtoOutput;
};
export type ActivityTypeOutput =
  | 'alpine_ski'
  | 'backcountry_ski'
  | 'badminton'
  | 'basketball'
  | 'canoeing'
  | 'cricket'
  | 'cross_country_ski'
  | 'crossfit'
  | 'dance'
  | 'e_bike_ride'
  | 'elliptical'
  | 'e_mountain_bike_ride'
  | 'golf'
  | 'gravel_ride'
  | 'handcycle'
  | 'high_intensity_interval_training'
  | 'hike'
  | 'ice_skate'
  | 'inline_skate'
  | 'kayaking'
  | 'kitesurf'
  | 'mountain_bike_ride'
  | 'padel'
  | 'physical_therapy'
  | 'pickleball'
  | 'pilates'
  | 'racquetball'
  | 'ride'
  | 'rock_climbing'
  | 'roller_ski'
  | 'rowing'
  | 'run'
  | 'sail'
  | 'skateboard'
  | 'snowboard'
  | 'snowshoe'
  | 'soccer'
  | 'squash'
  | 'stair_stepper'
  | 'stand_up_paddling'
  | 'surfing'
  | 'swim'
  | 'table_tennis'
  | 'tennis'
  | 'trail_run'
  | 'velomobile'
  | 'virtual_ride'
  | 'virtual_row'
  | 'virtual_run'
  | 'volleyball'
  | 'walk'
  | 'weight_training'
  | 'wheelchair'
  | 'windsurf'
  | 'workout'
  | 'yoga'
  | 'other';
export type LiveWorkoutListDtoOutput = {
  id: string;
  sport: ActivityTypeOutput;
  startedAt: string;
  status: 'recording' | 'paused' | 'ended' | 'discarded';
  canShare: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  lastSequence: number;
  lastPointAt: string | null;
  lastReceivedAt: string | null;
  route: number[][];
}[];
type GeneratedActivityType =
  | 'alpine_ski'
  | 'backcountry_ski'
  | 'badminton'
  | 'basketball'
  | 'canoeing'
  | 'cricket'
  | 'cross_country_ski'
  | 'crossfit'
  | 'dance'
  | 'e_bike_ride'
  | 'elliptical'
  | 'e_mountain_bike_ride'
  | 'golf'
  | 'gravel_ride'
  | 'handcycle'
  | 'high_intensity_interval_training'
  | 'hike'
  | 'ice_skate'
  | 'inline_skate'
  | 'kayaking'
  | 'kitesurf'
  | 'mountain_bike_ride'
  | 'padel'
  | 'physical_therapy'
  | 'pickleball'
  | 'pilates'
  | 'racquetball'
  | 'ride'
  | 'rock_climbing'
  | 'roller_ski'
  | 'rowing'
  | 'run'
  | 'sail'
  | 'skateboard'
  | 'snowboard'
  | 'snowshoe'
  | 'soccer'
  | 'squash'
  | 'stair_stepper'
  | 'stand_up_paddling'
  | 'surfing'
  | 'swim'
  | 'table_tennis'
  | 'tennis'
  | 'trail_run'
  | 'velomobile'
  | 'virtual_ride'
  | 'virtual_row'
  | 'virtual_run'
  | 'volleyball'
  | 'walk'
  | 'weight_training'
  | 'wheelchair'
  | 'windsurf'
  | 'workout'
  | 'yoga'
  | 'other';
export type LiveWorkoutCreateDto = {
  clientSessionId: string;
  sport: ActivityType;
  startedAt: string;
};
export type LiveWorkoutDtoOutput = {
  id: string;
  sport: ActivityTypeOutput;
  startedAt: string;
  status: 'recording' | 'paused' | 'ended' | 'discarded';
  canShare: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  lastSequence: number;
  lastPointAt: string | null;
  lastReceivedAt: string | null;
  route: number[][];
};
export type LiveWorkoutStateDto = {
  status: 'recording' | 'paused' | 'ended';
  elapsedSeconds: number;
  distanceMeters: number;
};
export type LiveWorkoutPointsDto = {
  points: {
    sequence: number;
    recordedAt: string;
    latitude: number;
    longitude: number;
    altitude?: number | null;
    accuracyMeters: number;
  }[];
  elapsedSeconds: number;
  distanceMeters: number;
};
export type LiveWorkoutAckDtoOutput = {
  id: string;
  lastSequence: number;
};
export type LiveWorkoutShareDtoOutput = {
  token: string;
  expiresAt: string;
};
export type ActivityTagOutput =
  'race' | 'long_run' | 'commute' | 'workout' | 'competition' | 'recovery' | 'with_pet' | 'with_kid' | 'for_a_cause';
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
export type BestEffortTypeOutput =
  | '400m'
  | '1k'
  | 'half_mile'
  | '1_mile'
  | '2_miles'
  | '5k'
  | '10k'
  | '15k'
  | '10_miles'
  | '20k'
  | 'half_marathon'
  | '30k'
  | 'marathon'
  | '50k'
  | 'longest_ride'
  | 'biggest_climb'
  | 'elevation_gain'
  | '5_miles'
  | '40k'
  | '80k'
  | '50_miles'
  | '90k'
  | '100k'
  | '100_miles'
  | '180k'
  | 'power_5s'
  | 'power_15s'
  | 'power_30s'
  | 'power_1m'
  | 'power_2m'
  | 'power_3m'
  | 'power_5m'
  | 'power_8m'
  | 'power_10m'
  | 'power_15m'
  | 'power_20m'
  | 'power_30m'
  | 'power_45m'
  | 'power_1h'
  | 'power_2h';
export type ActivityListResponseDtoOutput = {
  activities: {
    /** Activity id */
    id: string;
    /** Original uploaded activity filename */
    uploadFileName?: string;
    /** Activity owner id */
    userId?: string | null;
    athlete?: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    likeCount?: number;
    commentCount?: number;
    viewerLiked?: boolean;
    sport: ActivityTypeOutput;
    /** Activity name */
    name: string | null;
    /** Activity description */
    description: string | null;
    /** Exclude from rankings */
    excludeFromRankings: boolean;
    /** Activity tags */
    tags: ActivityTagOutput[];
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
          type: BestEffortTypeOutput;
          /** Best-effort value; watts for power efforts */
          value: number;
          overallRank: number;
          yearRank: number;
        }[]
      | null;
    achievementCount: number | null;
    /** Simplified GPS route as GeoJSON */
    track: {
      type: 'LineString';
      coordinates: number[][];
    } | null;
    images: {
      id: string;
      caption: string | null;
      sortOrder: number;
      width: number | null;
      height: number | null;
      status: 'pending' | 'ready' | 'failed';
      thumbnail: string | null;
      preview: string | null;
      original: string | null;
    }[];
  }[];
  /** Cursor for the next page, or null at the end */
  nextCursor: string | null;
  /** Total number of activities */
  total: number;
};
export type ActivityTag =
  'race' | 'long_run' | 'commute' | 'workout' | 'competition' | 'recovery' | 'with_pet' | 'with_kid' | 'for_a_cause';
export type DirectActivityCreateDto = {
  sport: ActivityType;
  name: string | null;
  description: string | null;
  tags: ActivityTag[];
  startedAt: string;
  timezoneOffsetMinutes: number | null;
  metrics: ActivityMetricDtoOutput;
  streams: {
    type:
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
    data: number[];
  }[];
  laps: {
    lapIndex: number;
    startedAt: string | null;
    elapsedTime: number | null;
    movingTime: number | null;
    distance: number | null;
    avgHr: number | null;
    maxHr: number | null;
    avgPower: number | null;
    avgSpeedMps: number | null;
  }[];
};
export type ActivityDtoOutput = {
  /** Activity id */
  id: string;
  /** Original uploaded activity filename */
  uploadFileName?: string;
  /** Activity owner id */
  userId?: string | null;
  athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  likeCount?: number;
  commentCount?: number;
  viewerLiked?: boolean;
  sport: ActivityTypeOutput;
  /** Activity name */
  name: string | null;
  /** Activity description */
  description: string | null;
  /** Exclude from rankings */
  excludeFromRankings: boolean;
  /** Activity tags */
  tags: ActivityTagOutput[];
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
export type ActivityTypeSettingsOutput = {
  type: ActivityTypeOutput;
  averageMetric: 'none' | 'pace' | 'swim_pace' | 'speed';
  showAveragePower: boolean;
  bestEffortGroup: 'none' | 'run' | 'ride';
};
export type ActivityTypeListResponseDtoOutput = ActivityTypeSettingsOutput[];
export type ActivityTagListResponseDtoOutput = {
  tag: ActivityTagOutput;
  label: string;
  sports: 'all' | ActivityTypeOutput[];
}[];
export type BestEffortSport = 'run' | 'ride';
export type BestEffortType =
  | '400m'
  | '1k'
  | 'half_mile'
  | '1_mile'
  | '2_miles'
  | '5k'
  | '10k'
  | '15k'
  | '10_miles'
  | '20k'
  | 'half_marathon'
  | '30k'
  | 'marathon'
  | '50k'
  | 'longest_ride'
  | 'biggest_climb'
  | 'elevation_gain'
  | '5_miles'
  | '40k'
  | '80k'
  | '50_miles'
  | '90k'
  | '100k'
  | '100_miles'
  | '180k'
  | 'power_5s'
  | 'power_15s'
  | 'power_30s'
  | 'power_1m'
  | 'power_2m'
  | 'power_3m'
  | 'power_5m'
  | 'power_8m'
  | 'power_10m'
  | 'power_15m'
  | 'power_20m'
  | 'power_30m'
  | 'power_45m'
  | 'power_1h'
  | 'power_2h';
export type BestEffortSportOutput = 'run' | 'ride';
export type BestEffortValueKindOutput = 'duration' | 'distance' | 'elevation' | 'power';
export type BestEffortListResponseDtoOutput = {
  sport: BestEffortSportOutput;
  type: BestEffortTypeOutput;
  valueKind: BestEffortValueKindOutput;
  higherIsBetter: boolean;
  /** Selected distance in meters, when applicable */
  distance: number | null;
  /** Selected duration in seconds, when applicable */
  duration: number | null;
  options: {
    type: BestEffortTypeOutput;
    valueKind: BestEffortValueKindOutput;
  }[];
  efforts: {
    activityId: string;
    activityName: string | null;
    sport: ActivityTypeOutput;
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
  /** Original uploaded activity filename */
  uploadFileName?: string;
  /** Activity owner id */
  userId?: string | null;
  athlete?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  likeCount?: number;
  commentCount?: number;
  viewerLiked?: boolean;
  sport: ActivityTypeOutput;
  /** Activity name */
  name: string | null;
  /** Activity description */
  description: string | null;
  /** Exclude from rankings */
  excludeFromRankings: boolean;
  /** Activity tags */
  tags: ActivityTagOutput[];
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
  images: {
    id: string;
    caption: string | null;
    sortOrder: number;
    width: number | null;
    height: number | null;
    status: 'pending' | 'ready' | 'failed';
    thumbnail: string | null;
    preview: string | null;
    original: string | null;
  }[];
  /** GPS route as GeoJSON */
  track: {
    type: 'LineString';
    coordinates: number[][];
  } | null;
  /** Split, profile, and route data for activity analysis */
  analysis: {
    /** Consecutive kilometre splits */
    splits: {
      /** Split distance in meters */
      distance: number;
      /** Split duration in seconds */
      elapsedTime: number;
      /** Start offset from activity start in seconds */
      startTime: number;
      /** End offset from activity start in seconds */
      endTime: number;
      /** Average heart rate during the split */
      avgHr: number | null;
      /** Net elevation change during the split in meters */
      elevationChange: number | null;
    }[];
    /** Downsampled elevation profile points */
    profile: {
      distance: number;
      time: number;
      altitude: number;
      heartRate: number | null;
    }[];
    /** Downsampled route points aligned to elapsed time */
    route: {
      time: number;
      coordinate: number[];
    }[];
  } | null;
  bestEfforts:
    | {
        type: BestEffortTypeOutput;
        /** Best-effort value; watts for power efforts */
        value: number;
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
  /** Exclude from rankings */
  excludeFromRankings?: boolean;
  /** Replace the activity tags */
  tags?: ActivityTag[];
  sport?: ActivityType;
  /** Updated start time in ISO-8601 format */
  startedAt?: string;
};
export type MatchedRouteListResponseDtoOutput = {
  sourceActivityId: string;
  activities:
    | {
        /** Activity id */
        id: string;
        /** Original uploaded activity filename */
        uploadFileName?: string;
        /** Activity owner id */
        userId?: string | null;
        athlete?: {
          id: string;
          firstName: string;
          lastName: string;
          avatarUrl: string | null;
        };
        likeCount?: number;
        commentCount?: number;
        viewerLiked?: boolean;
        sport: ActivityTypeOutput;
        /** Activity name */
        name: string | null;
        /** Activity description */
        description: string | null;
        /** Exclude from rankings */
        excludeFromRankings: boolean;
        /** Activity tags */
        tags: ActivityTagOutput[];
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
      }[]
    | null;
};
export type ActivityImageListDtoOutput = {
  id: string;
  caption: string | null;
  sortOrder: number;
  width: number | null;
  height: number | null;
  status: 'pending' | 'ready' | 'failed';
  thumbnail: string | null;
  preview: string | null;
  original: string | null;
}[];
export type ActivityImageDtoOutput = {
  id: string;
  caption: string | null;
  sortOrder: number;
  width: number | null;
  height: number | null;
  status: 'pending' | 'ready' | 'failed';
  thumbnail: string | null;
  preview: string | null;
  original: string | null;
};
export type ActivityImageUpdateDto = {
  caption?: string | null;
  sortOrder?: number;
};
export type AuthCapabilitiesDtoOutput = {
  direct: true;
};
export type SetupStatusDtoOutput = {
  setupRequired: boolean;
  registrationEnabled: boolean;
};
export type SetupCredentialsDto = {
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
  setupTicket: string;
};
export type AuthSessionDtoOutput = {
  accessToken: string;
  setup: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'admin' | 'user';
    avatarUrl: string | null;
  };
};
export type SetupTokenCredentialsDto = {
  setupToken: string;
};
export type SetupTicketDtoOutput = {
  token: string;
  expiresAt: string;
};
export type SetupTicketCredentialsDto = {
  setupTicket: string;
};
export type SetupValidationDtoOutput = {
  valid: true;
};
export type CredentialsDto = {
  email: string;
  firstName?: string;
  lastName?: string;
  password: string;
};
export type RegistrationCredentialsDto = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};
export type AuthUserDtoOutput = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'user';
  avatarUrl: string | null;
};
export type ActivityEventsTicketDtoOutput = {
  token: string;
  expiresAt: string;
};
export type UserCreateDto = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role?: 'user' | 'admin';
};
export type UserUpdateDto = {
  firstName: string;
  lastName: string;
};
export type PeopleListDtoOutput = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  relation: {
    following: boolean;
    incomingRequest: boolean;
    outgoingRequest: boolean;
    blockedByViewer: boolean;
    blockedViewer: boolean;
  };
}[];
export type PersonDtoOutput = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
  relation: {
    following: boolean;
    incomingRequest: boolean;
    outgoingRequest: boolean;
    blockedByViewer: boolean;
    blockedViewer: boolean;
  };
};
export type RequestListDtoOutput = {
  id: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
}[];
export type LikeStateDtoOutput = {
  liked: boolean;
  likeCount: number;
};
export type LikerListDtoOutput = {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}[];
export type NotificationListDtoOutput = {
  notifications: {
    id: string;
    type: 'activity_like' | 'activity_comment' | 'follow_request';
    createdAt: string;
    actor: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
    activityId: string | null;
    activityName: string | null;
    readAt: string | null;
  }[];
  unreadCount: number;
};
export type NotificationsReadDtoOutput = {
  markedRead: boolean;
};
export type CommentListDtoOutput = {
  comments: {
    id: string;
    body: string;
    createdAt: string;
    updatedAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatarUrl: string | null;
    };
  }[];
  nextCursor: string | null;
};
export type CommentCreateDto = {
  body: string;
};
export type CommentDtoOutput = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
  };
};
export type CommentUpdateDto = {
  body: string;
};
/**
 * Health check endpoint
 */
export function serverControllerPing(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: PingResponseDtoOutput;
  }>('/ping', {
    ...opts,
  });
}
/**
 * Upload a FIT, TCX, or GPX activity file
 */
export function uploadControllerUploadActivity(
  body: {
    /** .fit, .tcx, or .gpx activity file */
    file: Blob;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: FitUploadResponseDtoOutput;
  }>(
    '/upload/activity',
    oazapfts.multipart({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
/**
 * Create a browser-extracted Strava takeout import
 */
export function takeoutImportControllerCreate(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: TakeoutImportCreateResponseDtoOutput;
  }>('/upload/strava/imports', {
    ...opts,
    method: 'POST',
  });
}
/**
 * Record validated takeout manifest rows
 */
export function takeoutImportControllerScan(
  id: string,
  body?: {
    items: (
      | {
          itemKey: string;
          originalName: string;
          name: string | null;
          description: string | null;
          sport?:
            | 'alpine_ski'
            | 'backcountry_ski'
            | 'badminton'
            | 'basketball'
            | 'canoeing'
            | 'cricket'
            | 'cross_country_ski'
            | 'crossfit'
            | 'dance'
            | 'e_bike_ride'
            | 'elliptical'
            | 'e_mountain_bike_ride'
            | 'golf'
            | 'gravel_ride'
            | 'handcycle'
            | 'high_intensity_interval_training'
            | 'hike'
            | 'ice_skate'
            | 'inline_skate'
            | 'kayaking'
            | 'kitesurf'
            | 'mountain_bike_ride'
            | 'padel'
            | 'physical_therapy'
            | 'pickleball'
            | 'pilates'
            | 'racquetball'
            | 'ride'
            | 'rock_climbing'
            | 'roller_ski'
            | 'rowing'
            | 'run'
            | 'sail'
            | 'skateboard'
            | 'snowboard'
            | 'snowshoe'
            | 'soccer'
            | 'squash'
            | 'stair_stepper'
            | 'stand_up_paddling'
            | 'surfing'
            | 'swim'
            | 'table_tennis'
            | 'tennis'
            | 'trail_run'
            | 'velomobile'
            | 'virtual_ride'
            | 'virtual_row'
            | 'virtual_run'
            | 'volleyball'
            | 'walk'
            | 'weight_training'
            | 'wheelchair'
            | 'windsurf'
            | 'workout'
            | 'yoga'
            | 'other';
          tags: (
            | 'race'
            | 'long_run'
            | 'commute'
            | 'workout'
            | 'competition'
            | 'recovery'
            | 'with_pet'
            | 'with_kid'
            | 'for_a_cause'
          )[];
          kind: 'activity';
        }
      | {
          itemKey: string;
          kind: 'manual';
          sourceId: string;
          name: string | null;
          description: string | null;
          sport:
            | 'alpine_ski'
            | 'backcountry_ski'
            | 'badminton'
            | 'basketball'
            | 'canoeing'
            | 'cricket'
            | 'cross_country_ski'
            | 'crossfit'
            | 'dance'
            | 'e_bike_ride'
            | 'elliptical'
            | 'e_mountain_bike_ride'
            | 'golf'
            | 'gravel_ride'
            | 'handcycle'
            | 'high_intensity_interval_training'
            | 'hike'
            | 'ice_skate'
            | 'inline_skate'
            | 'kayaking'
            | 'kitesurf'
            | 'mountain_bike_ride'
            | 'padel'
            | 'physical_therapy'
            | 'pickleball'
            | 'pilates'
            | 'racquetball'
            | 'ride'
            | 'rock_climbing'
            | 'roller_ski'
            | 'rowing'
            | 'run'
            | 'sail'
            | 'skateboard'
            | 'snowboard'
            | 'snowshoe'
            | 'soccer'
            | 'squash'
            | 'stair_stepper'
            | 'stand_up_paddling'
            | 'surfing'
            | 'swim'
            | 'table_tennis'
            | 'tennis'
            | 'trail_run'
            | 'velomobile'
            | 'virtual_ride'
            | 'virtual_row'
            | 'virtual_run'
            | 'volleyball'
            | 'walk'
            | 'weight_training'
            | 'wheelchair'
            | 'windsurf'
            | 'workout'
            | 'yoga'
            | 'other';
          tags: (
            | 'race'
            | 'long_run'
            | 'commute'
            | 'workout'
            | 'competition'
            | 'recovery'
            | 'with_pet'
            | 'with_kid'
            | 'for_a_cause'
          )[];
          startedAt: string;
          elapsedTime: number;
          movingTime: number | null;
          distance: number | null;
          elevationGain: number | null;
          elevationLoss: number | null;
          avgSpeed: number | null;
          maxSpeed: number | null;
          avgHr: number | null;
          maxHr: number | null;
          calories: number | null;
        }
    )[];
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: TakeoutImportScanResponseDtoOutput;
  }>(
    `/upload/strava/imports/${encodeURIComponent(id)}/scan`,
    oazapfts.json({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
/**
 * Upload one extracted Strava activity
 */
export function takeoutImportControllerUploadActivity(
  id: string,
  body: {
    /** One extracted .fit, .tcx, or .gpx activity file */
    file: Blob;
    metadata: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 202;
    data: TakeoutItemSubmissionResponseDtoOutput;
  }>(
    `/upload/strava/imports/${encodeURIComponent(id)}/activities`,
    oazapfts.multipart({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
/**
 * Submit one manual Strava activity
 */
export function takeoutImportControllerSubmitManual(
  id: string,
  body?: {
    itemKey: string;
    kind: 'manual';
    sourceId: string;
    name: string | null;
    description: string | null;
    sport:
      | 'alpine_ski'
      | 'backcountry_ski'
      | 'badminton'
      | 'basketball'
      | 'canoeing'
      | 'cricket'
      | 'cross_country_ski'
      | 'crossfit'
      | 'dance'
      | 'e_bike_ride'
      | 'elliptical'
      | 'e_mountain_bike_ride'
      | 'golf'
      | 'gravel_ride'
      | 'handcycle'
      | 'high_intensity_interval_training'
      | 'hike'
      | 'ice_skate'
      | 'inline_skate'
      | 'kayaking'
      | 'kitesurf'
      | 'mountain_bike_ride'
      | 'padel'
      | 'physical_therapy'
      | 'pickleball'
      | 'pilates'
      | 'racquetball'
      | 'ride'
      | 'rock_climbing'
      | 'roller_ski'
      | 'rowing'
      | 'run'
      | 'sail'
      | 'skateboard'
      | 'snowboard'
      | 'snowshoe'
      | 'soccer'
      | 'squash'
      | 'stair_stepper'
      | 'stand_up_paddling'
      | 'surfing'
      | 'swim'
      | 'table_tennis'
      | 'tennis'
      | 'trail_run'
      | 'velomobile'
      | 'virtual_ride'
      | 'virtual_row'
      | 'virtual_run'
      | 'volleyball'
      | 'walk'
      | 'weight_training'
      | 'wheelchair'
      | 'windsurf'
      | 'workout'
      | 'yoga'
      | 'other';
    tags: (
      'race' | 'long_run' | 'commute' | 'workout' | 'competition' | 'recovery' | 'with_pet' | 'with_kid' | 'for_a_cause'
    )[];
    startedAt: string;
    elapsedTime: number;
    movingTime: number | null;
    distance: number | null;
    elevationGain: number | null;
    elevationLoss: number | null;
    avgSpeed: number | null;
    maxSpeed: number | null;
    avgHr: number | null;
    maxHr: number | null;
    calories: number | null;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 202;
    data: TakeoutItemSubmissionResponseDtoOutput;
  }>(
    `/upload/strava/imports/${encodeURIComponent(id)}/manual-activities`,
    oazapfts.json({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
/**
 * Record an extraction failure for one takeout item
 */
export function takeoutImportControllerFailItem(
  id: string,
  body?: {
    itemKey: string;
    error: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 202;
    data: TakeoutItemSubmissionResponseDtoOutput;
  }>(
    `/upload/strava/imports/${encodeURIComponent(id)}/items/fail`,
    oazapfts.json({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
/**
 * Mark browser extraction complete
 */
export function takeoutImportControllerFinalize(
  id: string,
  body?: {
    extractionErrors?: number;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: TakeoutImportStatusDtoOutput;
  }>(
    `/upload/strava/imports/${encodeURIComponent(id)}/finalize`,
    oazapfts.json({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
/**
 * Cancel a takeout import
 */
export function takeoutImportControllerCancel(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/upload/strava/imports/${encodeURIComponent(id)}/cancel`, {
    ...opts,
    method: 'POST',
  });
}
/**
 * Get browser takeout import progress
 */
export function takeoutImportControllerGetStatus(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: TakeoutImportStatusDtoOutput;
  }>(`/upload/strava/imports/${encodeURIComponent(id)}`, {
    ...opts,
  });
}
/**
 * Queue depths and worker status
 */
export function jobControllerGetAllJobStatus(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: AllJobStatusResponseDtoOutput;
  }>('/jobs', {
    ...opts,
  });
}
/**
 * Run a job by hand
 */
export function jobControllerCreateJob(jobCreateDto: JobCreateDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(
    '/jobs',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: jobCreateDto,
    }),
  );
}
/**
 * Recent job execution history
 */
export function jobControllerGetJobHistory(
  {
    limit,
    offset,
  }: {
    limit?: number;
    offset?: number;
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: JobHistoryResponseDtoOutput;
  }>(
    `/jobs/history${QS.query(
      QS.explode({
        limit,
        offset,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
/**
 * Control a queue
 */
export function jobControllerRunQueueCommand(
  name: QueueName,
  queueCommandDto: QueueCommandDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: QueueStatusReportDtoOutput;
  }>(
    `/jobs/${encodeURIComponent(name)}`,
    oazapfts.json({
      ...opts,
      method: 'PUT',
      body: queueCommandDto,
    }),
  );
}
export function liveWorkoutControllerList(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LiveWorkoutListDtoOutput;
  }>('/live-workouts', {
    ...opts,
  });
}
export function liveWorkoutControllerCreate(liveWorkoutCreateDto: LiveWorkoutCreateDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: LiveWorkoutDtoOutput;
  }>(
    '/live-workouts',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: liveWorkoutCreateDto,
    }),
  );
}
export function liveWorkoutControllerGetShared(token: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LiveWorkoutDtoOutput;
  }>(`/live-workouts/shared/${encodeURIComponent(token)}`, {
    ...opts,
  });
}
export function liveWorkoutControllerGet(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LiveWorkoutDtoOutput;
  }>(`/live-workouts/${encodeURIComponent(id)}`, {
    ...opts,
  });
}
export function liveWorkoutControllerUpdate(
  id: string,
  liveWorkoutStateDto: LiveWorkoutStateDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LiveWorkoutDtoOutput;
  }>(
    `/live-workouts/${encodeURIComponent(id)}`,
    oazapfts.json({
      ...opts,
      method: 'PATCH',
      body: liveWorkoutStateDto,
    }),
  );
}
export function liveWorkoutControllerDiscard(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/live-workouts/${encodeURIComponent(id)}`, {
    ...opts,
    method: 'DELETE',
  });
}
export function liveWorkoutControllerPoints(
  id: string,
  liveWorkoutPointsDto: LiveWorkoutPointsDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: LiveWorkoutAckDtoOutput;
  }>(
    `/live-workouts/${encodeURIComponent(id)}/points`,
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: liveWorkoutPointsDto,
    }),
  );
}
export function liveWorkoutControllerShare(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: LiveWorkoutShareDtoOutput;
  }>(`/live-workouts/${encodeURIComponent(id)}/share`, {
    ...opts,
    method: 'POST',
  });
}
export function liveWorkoutControllerRevokeShare(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/live-workouts/${encodeURIComponent(id)}/share`, {
    ...opts,
    method: 'DELETE',
  });
}
/**
 * List recent activities
 */
export function activityControllerListRecent(
  {
    cursor,
    limit,
    search,
    tags,
    tagMatch,
  }: {
    cursor?: string;
    limit?: number;
    search?: string;
    tags?: string;
    tagMatch?: 'any' | 'all';
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityListResponseDtoOutput;
  }>(
    `/activities${QS.query(
      QS.explode({
        cursor,
        limit,
        search,
        tags,
        tagMatch,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
/**
 * Create an activity from direct data
 */
export function activityControllerCreate(
  directActivityCreateDto: DirectActivityCreateDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: ActivityDtoOutput;
  }>(
    '/activities',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: directActivityCreateDto,
    }),
  );
}
/**
 * List activity types and their behavior
 */
export function activityControllerListTypes(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityTypeListResponseDtoOutput;
  }>('/activities/types', {
    ...opts,
  });
}
/**
 * List activity tags and their applicability
 */
export function activityControllerListTags(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityTagListResponseDtoOutput;
  }>('/activities/tags', {
    ...opts,
  });
}
/**
 * List best efforts over time for a sport
 */
export function activityControllerListBestEfforts(
  sport: BestEffortSport,
  $type: BestEffortType,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: BestEffortListResponseDtoOutput;
  }>(`/activities/best-efforts/${encodeURIComponent(sport)}/${encodeURIComponent($type)}`, {
    ...opts,
  });
}
/**
 * Get one activity and its route
 */
export function activityControllerGetById(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityDetailDtoOutput;
  }>(`/activities/${encodeURIComponent(id)}`, {
    ...opts,
  });
}
/**
 * Update one activity
 */
export function activityControllerUpdateById(
  id: string,
  activityUpdateDto: ActivityUpdateDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityDtoOutput;
  }>(
    `/activities/${encodeURIComponent(id)}`,
    oazapfts.json({
      ...opts,
      method: 'PUT',
      body: activityUpdateDto,
    }),
  );
}
/**
 * Delete one activity
 */
export function activityControllerDeleteById(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/activities/${encodeURIComponent(id)}`, {
    ...opts,
    method: 'DELETE',
  });
}
/**
 * List activities matched to the same GPS route
 */
export function activityControllerListMatchedRoutes(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: MatchedRouteListResponseDtoOutput;
  }>(`/activities/${encodeURIComponent(id)}/matched-routes`, {
    ...opts,
  });
}
/**
 * List ready images attached to an activity
 */
export function activityImageControllerList(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityImageListDtoOutput;
  }>(`/activities/${encodeURIComponent(id)}/images`, {
    ...opts,
  });
}
/**
 * Upload an image to an activity
 */
export function activityImageControllerUpload(
  id: string,
  body: {
    file: Blob;
    caption?: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: ActivityImageDtoOutput;
  }>(
    `/activities/${encodeURIComponent(id)}/images`,
    oazapfts.multipart({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
export function activityImageControllerUpdate(
  activityId: string,
  imageId: string,
  activityImageUpdateDto: ActivityImageUpdateDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityImageDtoOutput;
  }>(
    `/activities/${encodeURIComponent(activityId)}/images/${encodeURIComponent(imageId)}`,
    oazapfts.json({
      ...opts,
      method: 'PATCH',
      body: activityImageUpdateDto,
    }),
  );
}
export function activityImageControllerDelete(activityId: string, imageId: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/activities/${encodeURIComponent(activityId)}/images/${encodeURIComponent(imageId)}`, {
    ...opts,
    method: 'DELETE',
  });
}
/**
 * Read an image variant
 */
export function activityImageControllerFile(imageId: string, variant: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchBlob<
    | {
        status: 200;
        data: Blob;
      }
    | {
        status: 206;
        data: Blob;
      }
    | {
        status: 304;
      }
    | {
        status: 404;
      }
    | {
        status: 416;
      }
  >(`/activity-images/${encodeURIComponent(imageId)}/${encodeURIComponent(variant)}`, {
    ...opts,
  });
}
export function authControllerCapabilities(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: AuthCapabilitiesDtoOutput;
  }>('/auth/capabilities', {
    ...opts,
  });
}
export function authControllerSetupStatus(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: SetupStatusDtoOutput;
  }>('/auth/setup', {
    ...opts,
  });
}
export function authControllerSetup(setupCredentialsDto: SetupCredentialsDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: AuthSessionDtoOutput;
  }>(
    '/auth/setup',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: setupCredentialsDto,
    }),
  );
}
export function authControllerVerifySetupToken(
  setupTokenCredentialsDto: SetupTokenCredentialsDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: SetupTicketDtoOutput;
  }>(
    '/auth/setup/verify',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: setupTokenCredentialsDto,
    }),
  );
}
export function authControllerValidateSetupTicket(
  setupTicketCredentialsDto: SetupTicketCredentialsDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: SetupValidationDtoOutput;
  }>(
    '/auth/setup/validate',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: setupTicketCredentialsDto,
    }),
  );
}
export function authControllerLogin(credentialsDto: CredentialsDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: AuthSessionDtoOutput;
  }>(
    '/auth/login',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: credentialsDto,
    }),
  );
}
export function authControllerRegister(
  registrationCredentialsDto: RegistrationCredentialsDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 201;
    data: AuthSessionDtoOutput;
  }>(
    '/auth/register',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: registrationCredentialsDto,
    }),
  );
}
export function authControllerMe(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: AuthUserDtoOutput;
  }>('/auth/me', {
    ...opts,
  });
}
export function authControllerLogout(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText('/auth/logout', {
    ...opts,
    method: 'POST',
  });
}
export function authControllerActivityEventsTicket(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: ActivityEventsTicketDtoOutput;
  }>('/auth/activity-events-ticket', {
    ...opts,
    method: 'POST',
  });
}
export function authControllerJobEventsTicket(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: ActivityEventsTicketDtoOutput;
  }>('/auth/job-events-ticket', {
    ...opts,
    method: 'POST',
  });
}
export function userControllerList(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText('/users', {
    ...opts,
  });
}
export function userControllerCreate(userCreateDto: UserCreateDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(
    '/users',
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: userCreateDto,
    }),
  );
}
export function userControllerUpdateMe(userUpdateDto: UserUpdateDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(
    '/users/me',
    oazapfts.json({
      ...opts,
      method: 'PATCH',
      body: userUpdateDto,
    }),
  );
}
export function userControllerUploadAvatar(
  body: {
    file: Blob;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchText(
    '/users/me/avatar',
    oazapfts.multipart({
      ...opts,
      method: 'POST',
      body,
    }),
  );
}
export function userControllerDeleteAvatar(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText('/users/me/avatar', {
    ...opts,
    method: 'DELETE',
  });
}
export function userControllerAvatarFile(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchBlob<
    | {
        status: 200;
        data: Blob;
      }
    | {
        status: 206;
        data: Blob;
      }
    | {
        status: 304;
      }
    | {
        status: 404;
      }
    | {
        status: 416;
      }
  >(`/users/${encodeURIComponent(id)}/avatar`, {
    ...opts,
  });
}
export function socialControllerPeople(
  {
    query,
  }: {
    query?: string;
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: PeopleListDtoOutput;
  }>(
    `/people${QS.query(
      QS.explode({
        query,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
export function socialControllerPerson(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: PersonDtoOutput;
  }>(`/people/${encodeURIComponent(id)}`, {
    ...opts,
  });
}
export function socialControllerActivities(
  id: string,
  {
    cursor,
    limit,
    search,
    tags,
    tagMatch,
  }: {
    cursor?: string;
    limit?: number;
    search?: string;
    tags?: string;
    tagMatch?: 'any' | 'all';
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityListResponseDtoOutput;
  }>(
    `/people/${encodeURIComponent(id)}/activities${QS.query(
      QS.explode({
        cursor,
        limit,
        search,
        tags,
        tagMatch,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
export function socialControllerSend(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/people/${encodeURIComponent(id)}/follow-request`, {
    ...opts,
    method: 'POST',
  });
}
export function socialControllerCancel(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/people/${encodeURIComponent(id)}/follow-request`, {
    ...opts,
    method: 'DELETE',
  });
}
export function socialControllerUnfollow(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/people/${encodeURIComponent(id)}/follow`, {
    ...opts,
    method: 'DELETE',
  });
}
export function socialControllerBlock(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/people/${encodeURIComponent(id)}/block`, {
    ...opts,
    method: 'PUT',
  });
}
export function socialControllerUnblock(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/people/${encodeURIComponent(id)}/block`, {
    ...opts,
    method: 'DELETE',
  });
}
export function socialControllerRequests(
  {
    direction,
  }: {
    direction?: 'incoming' | 'outgoing';
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: RequestListDtoOutput;
  }>(
    `/follow-requests${QS.query(
      QS.explode({
        direction,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
export function socialControllerAccept(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/follow-requests/${encodeURIComponent(id)}/accept`, {
    ...opts,
    method: 'POST',
  });
}
export function socialControllerIgnore(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/follow-requests/${encodeURIComponent(id)}`, {
    ...opts,
    method: 'DELETE',
  });
}
export function socialControllerFeed(
  {
    cursor,
    limit,
    search,
    tags,
    tagMatch,
  }: {
    cursor?: string;
    limit?: number;
    search?: string;
    tags?: string;
    tagMatch?: 'any' | 'all';
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: ActivityListResponseDtoOutput;
  }>(
    `/feed${QS.query(
      QS.explode({
        cursor,
        limit,
        search,
        tags,
        tagMatch,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
export function socialControllerLike(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LikeStateDtoOutput;
  }>(`/activities/${encodeURIComponent(id)}/like`, {
    ...opts,
    method: 'PUT',
  });
}
export function socialControllerUnlike(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LikeStateDtoOutput;
  }>(`/activities/${encodeURIComponent(id)}/like`, {
    ...opts,
    method: 'DELETE',
  });
}
export function socialControllerLikers(id: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: LikerListDtoOutput;
  }>(`/activities/${encodeURIComponent(id)}/likes`, {
    ...opts,
  });
}
export function socialControllerNotifications(
  {
    limit,
  }: {
    limit?: number;
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: NotificationListDtoOutput;
  }>(
    `/notifications${QS.query(
      QS.explode({
        limit,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
export function socialControllerMarkNotificationsRead(opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 200;
    data: NotificationsReadDtoOutput;
  }>('/notifications/read', {
    ...opts,
    method: 'PATCH',
  });
}
export function socialControllerComments(
  id: string,
  {
    cursor,
    limit,
  }: {
    cursor?: string;
    limit?: number;
  } = {},
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: CommentListDtoOutput;
  }>(
    `/activities/${encodeURIComponent(id)}/comments${QS.query(
      QS.explode({
        cursor,
        limit,
      }),
    )}`,
    {
      ...opts,
    },
  );
}
export function socialControllerComment(id: string, commentCreateDto: CommentCreateDto, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchJson<{
    status: 201;
    data: CommentDtoOutput;
  }>(
    `/activities/${encodeURIComponent(id)}/comments`,
    oazapfts.json({
      ...opts,
      method: 'POST',
      body: commentCreateDto,
    }),
  );
}
export function socialControllerUpdateComment(
  activityId: string,
  commentId: string,
  commentUpdateDto: CommentUpdateDto,
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.fetchJson<{
    status: 200;
    data: CommentDtoOutput;
  }>(
    `/activities/${encodeURIComponent(activityId)}/comments/${encodeURIComponent(commentId)}`,
    oazapfts.json({
      ...opts,
      method: 'PATCH',
      body: commentUpdateDto,
    }),
  );
}
export function socialControllerDeleteComment(activityId: string, commentId: string, opts?: Oazapfts.RequestOpts) {
  return oazapfts.fetchText(`/activities/${encodeURIComponent(activityId)}/comments/${encodeURIComponent(commentId)}`, {
    ...opts,
    method: 'DELETE',
  });
}
