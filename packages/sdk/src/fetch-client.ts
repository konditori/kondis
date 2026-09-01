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
  /** Identifier used to poll import progress */
  importId: string;
};
export type TakeoutImportStatusDtoOutput = {
  importId: string;
  status: Status;
  total: number | null;
  processed: number;
  failed: number;
  duplicates: number;
  error: string[];
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
  name: Name;
};
export type QueueCommandDto = {
  /** Operation to perform on the queue */
  command: Command;
};
export type QueueStatusReportDtoOutput = {
  jobCounts: JobCountsDtoOutput;
  queueStatus: QueueStatusDtoOutput;
};
export type LiveWorkoutListDtoOutput = {
  id: string;
  sport: ActivityType_Output;
  startedAt: string;
  status: Status2;
  canShare: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  lastSequence: number;
  lastPointAt: string | null;
  lastReceivedAt: string | null;
  route: never[][];
}[];
export type LiveWorkoutCreateDto = {
  clientSessionId: string;
  sport: ActivityType;
  startedAt: string;
};
export type LiveWorkoutDtoOutput = {
  id: string;
  sport: ActivityType_Output;
  startedAt: string;
  status: Status2;
  canShare: boolean;
  elapsedSeconds: number;
  distanceMeters: number;
  lastSequence: number;
  lastPointAt: string | null;
  lastReceivedAt: string | null;
  route: never[][];
};
export type LiveWorkoutStateDto = {
  status: Status3;
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
    sport: ActivityType_Output;
    /** Activity name */
    name: string | null;
    /** Activity description */
    description: string | null;
    /** Exclude from rankings */
    excludeFromRankings: boolean;
    /** Activity tags */
    tags: ActivityTag_Output[];
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
          /** Best-effort value; watts for power efforts */
          value: number;
          overallRank: number;
          yearRank: number;
        }[]
      | null;
    achievementCount: number | null;
    /** Simplified GPS route as GeoJSON */
    track: {
      type: Type;
      coordinates: never[][];
    } | null;
    images: {
      id: string;
      caption: string | null;
      sortOrder: number;
      width: number | null;
      height: number | null;
      status: Status4;
      thumbnail: string | null;
      preview: string | null;
      original: string | null;
    }[];
  }[];
  /** Cursor for the next page, or null at the end */
  nextCursor: string[];
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
export type ActivityTagListResponseDtoOutput = {
  tag: ActivityTag_Output;
  label: string;
  sports: 'all' | ActivityType_Output[];
}[];
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
  sport: ActivityType_Output;
  /** Activity name */
  name: string[];
  /** Activity description */
  description: string[];
  /** Exclude from rankings */
  excludeFromRankings: boolean;
  /** Activity tags */
  tags: ActivityTag_Output[];
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
    status: Status4;
    thumbnail: string | null;
    preview: string | null;
    original: string | null;
  }[];
  /** GPS route as GeoJSON */
  track: {
    type: Type;
    coordinates: never[][];
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
      coordinate: never[];
    }[];
  } | null;
  bestEfforts:
    | {
        type: BestEffortType_Output;
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
export type ActivityDtoOutput = {
  /** Activity id */
  id: string;
    /** Source upload id */
    uploadId: string;
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
  sport: ActivityType_Output;
  /** Activity name */
  name: string[];
  /** Activity description */
  description: string[];
  /** Exclude from rankings */
  excludeFromRankings: boolean;
  /** Activity tags */
  tags: ActivityTag_Output[];
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
  activities:
    | {
        /** Activity id */
        id: string;
        /** Source upload id */
        uploadId: string;
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
        sport: ActivityType_Output;
        /** Activity name */
        name: string | null;
        /** Activity description */
        description: string | null;
        /** Exclude from rankings */
        excludeFromRankings: boolean;
        /** Activity tags */
        tags: ActivityTag_Output[];
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
export type ActivityImageDtoOutput = {
  id: string;
  caption: string[];
  sortOrder: number;
  width: number | null;
  height: number | null;
  status: Status4;
  thumbnail: string[];
  preview: string[];
  original: string[];
};
export type ActivityImageListDtoOutput = {
  id: string;
  caption: string | null;
  sortOrder: number;
  width: number | null;
  height: number | null;
  status: Status4;
  thumbnail: string | null;
  preview: string | null;
  original: string | null;
}[];
export type ActivityImageUpdateDto = {
  caption?: string | null;
  sortOrder?: number;
};
export type ActivityEventsTicketDtoOutput = {
  token: string;
  expiresAt: string;
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
    type: Type2;
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
  nextCursor: string[];
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
 * Get Strava takeout import progress
 */
export function uploadControllerGetStravaTakeoutStatus(
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
      data: TakeoutImportStatusDtoOutput;
    }>(`/upload/strava/${encodeURIComponent(id)}`, {
      ...opts,
    }),
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
export function liveWorkoutControllerList(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: LiveWorkoutListDtoOutput;
    }>('/live-workouts', {
      ...opts,
    }),
  );
}
export function liveWorkoutControllerCreate(
  {
    liveWorkoutCreateDto,
  }: {
    liveWorkoutCreateDto: LiveWorkoutCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: LiveWorkoutDtoOutput;
    }>(
      '/live-workouts',
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: liveWorkoutCreateDto,
      }),
    ),
  );
}
export function liveWorkoutControllerGetShared(
  {
    token,
  }: {
    token: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: LiveWorkoutDtoOutput;
    }>(`/live-workouts/shared/${encodeURIComponent(token)}`, {
      ...opts,
    }),
  );
}
export function liveWorkoutControllerGet(
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
      data: LiveWorkoutDtoOutput;
    }>(`/live-workouts/${encodeURIComponent(id)}`, {
      ...opts,
    }),
  );
}
export function liveWorkoutControllerUpdate(
  {
    id,
    liveWorkoutStateDto,
  }: {
    id: string;
    liveWorkoutStateDto: LiveWorkoutStateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: LiveWorkoutDtoOutput;
    }>(
      `/live-workouts/${encodeURIComponent(id)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: liveWorkoutStateDto,
      }),
    ),
  );
}
export function liveWorkoutControllerDiscard(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/live-workouts/${encodeURIComponent(id)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function liveWorkoutControllerPoints(
  {
    id,
    liveWorkoutPointsDto,
  }: {
    id: string;
    liveWorkoutPointsDto: LiveWorkoutPointsDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: LiveWorkoutAckDtoOutput;
    }>(
      `/live-workouts/${encodeURIComponent(id)}/points`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: liveWorkoutPointsDto,
      }),
    ),
  );
}
export function liveWorkoutControllerShare(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: LiveWorkoutShareDtoOutput;
    }>(`/live-workouts/${encodeURIComponent(id)}/share`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export function liveWorkoutControllerRevokeShare(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/live-workouts/${encodeURIComponent(id)}/share`, {
      ...opts,
      method: 'DELETE',
    }),
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
    tags,
    tagMatch,
  }: {
    cursor?: string;
    limit?: number;
    search?: string;
    tags?: string;
    tagMatch?: 'any' | 'all';
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
          tags,
          tagMatch,
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
 * List activity tags and their applicability
 */
export function activityControllerListTags(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ActivityTagListResponseDtoOutput;
    }>('/activities/tags', {
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
/**
 * Upload an image to an activity
 */
export function activityImageControllerUpload(
  {
    id,
    body,
  }: {
    id: string;
    body: {
      file: Blob;
      caption?: string;
    };
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: ActivityImageDtoOutput;
    }>(
      `/activities/${encodeURIComponent(id)}/images`,
      oazapfts.multipart({
        ...opts,
        method: 'POST',
        body,
      }),
    ),
  );
}
/**
 * List ready images attached to an activity
 */
export function activityImageControllerList(
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
      data: ActivityImageListDtoOutput;
    }>(`/activities/${encodeURIComponent(id)}/images`, {
      ...opts,
    }),
  );
}
export function activityImageControllerUpdate(
  {
    activityId,
    imageId,
    activityImageUpdateDto,
  }: {
    activityId: string;
    imageId: string;
    activityImageUpdateDto: ActivityImageUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: ActivityImageDtoOutput;
    }>(
      `/activities/${encodeURIComponent(activityId)}/images/${encodeURIComponent(imageId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: activityImageUpdateDto,
      }),
    ),
  );
}
export function activityImageControllerDelete(
  {
    activityId,
    imageId,
  }: {
    activityId: string;
    imageId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/activities/${encodeURIComponent(activityId)}/images/${encodeURIComponent(imageId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
/**
 * Read an image variant
 */
export function activityImageControllerFile(
  {
    imageId,
    variant,
  }: {
    imageId: string;
    variant: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/activity-images/${encodeURIComponent(imageId)}/${encodeURIComponent(variant)}`, {
      ...opts,
    }),
  );
}
export function authControllerCapabilities(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/capabilities', {
      ...opts,
    }),
  );
}
export function authControllerSetupStatus(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/setup', {
      ...opts,
    }),
  );
}
export function authControllerSetup(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/setup', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function authControllerVerifySetupToken(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/setup/verify', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function authControllerValidateSetupTicket(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/setup/validate', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function authControllerLogin(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/login', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function authControllerRegister(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/register', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function authControllerMe(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/auth/me', {
      ...opts,
    }),
  );
}
export function authControllerActivityEventsTicket(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: ActivityEventsTicketDtoOutput;
    }>('/auth/activity-events-ticket', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function userControllerList(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/users', {
      ...opts,
    }),
  );
}
export function userControllerCreate(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/users', {
      ...opts,
      method: 'POST',
    }),
  );
}
export function userControllerUpdateMe(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/users/me', {
      ...opts,
      method: 'PATCH',
    }),
  );
}
export function userControllerUploadAvatar(
  {
    body,
  }: {
    body: {
      file: Blob;
    };
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(
      '/users/me/avatar',
      oazapfts.multipart({
        ...opts,
        method: 'POST',
        body,
      }),
    ),
  );
}
export function userControllerDeleteAvatar(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchText('/users/me/avatar', {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function userControllerAvatarFile(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/users/${encodeURIComponent(id)}/avatar`, {
      ...opts,
    }),
  );
}
export function socialControllerPeople(
  {
    query,
  }: {
    query: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
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
    ),
  );
}
export function socialControllerPerson(
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
      data: PersonDtoOutput;
    }>(`/people/${encodeURIComponent(id)}`, {
      ...opts,
    }),
  );
}
export function socialControllerActivities(
  {
    id,
    cursor,
    limit,
    search,
    tags,
    tagMatch,
  }: {
    id: string;
    cursor?: string;
    limit?: number;
    search?: string;
    tags?: string;
    tagMatch?: 'any' | 'all';
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
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
    ),
  );
}
export function socialControllerSend(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/people/${encodeURIComponent(id)}/follow-request`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export function socialControllerCancel(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/people/${encodeURIComponent(id)}/follow-request`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function socialControllerUnfollow(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/people/${encodeURIComponent(id)}/follow`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function socialControllerBlock(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/people/${encodeURIComponent(id)}/block`, {
      ...opts,
      method: 'PUT',
    }),
  );
}
export function socialControllerUnblock(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/people/${encodeURIComponent(id)}/block`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function socialControllerRequests(
  {
    direction,
  }: {
    direction?: 'incoming' | 'outgoing';
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
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
    ),
  );
}
export function socialControllerAccept(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/follow-requests/${encodeURIComponent(id)}/accept`, {
      ...opts,
      method: 'POST',
    }),
  );
}
export function socialControllerIgnore(
  {
    id,
  }: {
    id: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/follow-requests/${encodeURIComponent(id)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
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
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
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
    ),
  );
}
export function socialControllerLike(
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
      data: LikeStateDtoOutput;
    }>(`/activities/${encodeURIComponent(id)}/like`, {
      ...opts,
      method: 'PUT',
    }),
  );
}
export function socialControllerUnlike(
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
      data: LikeStateDtoOutput;
    }>(`/activities/${encodeURIComponent(id)}/like`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export function socialControllerLikers(
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
      data: LikerListDtoOutput;
    }>(`/activities/${encodeURIComponent(id)}/likes`, {
      ...opts,
    }),
  );
}
export function socialControllerNotifications(
  {
    limit,
  }: {
    limit: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
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
    ),
  );
}
export function socialControllerMarkNotificationsRead(opts?: Oazapfts.RequestOpts) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: NotificationsReadDtoOutput;
    }>('/notifications/read', {
      ...opts,
      method: 'PATCH',
    }),
  );
}
export function socialControllerComments(
  {
    id,
    cursor,
    limit,
  }: {
    id: string;
    cursor: string;
    limit: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
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
    ),
  );
}
export function socialControllerComment(
  {
    id,
    commentCreateDto,
  }: {
    id: string;
    commentCreateDto: CommentCreateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 201;
      data: CommentDtoOutput;
    }>(
      `/activities/${encodeURIComponent(id)}/comments`,
      oazapfts.json({
        ...opts,
        method: 'POST',
        body: commentCreateDto,
      }),
    ),
  );
}
export function socialControllerUpdateComment(
  {
    activityId,
    commentId,
    commentUpdateDto,
  }: {
    activityId: string;
    commentId: string;
    commentUpdateDto: CommentUpdateDto;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchJson<{
      status: 200;
      data: CommentDtoOutput;
    }>(
      `/activities/${encodeURIComponent(activityId)}/comments/${encodeURIComponent(commentId)}`,
      oazapfts.json({
        ...opts,
        method: 'PATCH',
        body: commentUpdateDto,
      }),
    ),
  );
}
export function socialControllerDeleteComment(
  {
    activityId,
    commentId,
  }: {
    activityId: string;
    commentId: string;
  },
  opts?: Oazapfts.RequestOpts,
) {
  return oazapfts.ok(
    oazapfts.fetchText(`/activities/${encodeURIComponent(activityId)}/comments/${encodeURIComponent(commentId)}`, {
      ...opts,
      method: 'DELETE',
    }),
  );
}
export enum Status {
  Queued = 'queued',
  Processing = 'processing',
  Completed = 'completed',
  Failed = 'failed',
}
export enum Name {
  ReparseFailedUploads = 'reparse-failed-uploads',
  ReparseAllUploads = 'reparse-all-uploads',
}
export enum QueueName {
  ActivityParsing = 'activityParsing',
  BackgroundTask = 'backgroundTask',
  ImageProcessing = 'imageProcessing',
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
export enum Status2 {
  Recording = 'recording',
  Paused = 'paused',
  Ended = 'ended',
  Discarded = 'discarded',
}
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
export enum Status3 {
  Recording = 'recording',
  Paused = 'paused',
  Ended = 'ended',
}
export enum ActivityTag_Output {
  Race = 'race',
  LongRun = 'long_run',
  Commute = 'commute',
  Workout = 'workout',
  Competition = 'competition',
  Recovery = 'recovery',
  WithPet = 'with_pet',
  WithKid = 'with_kid',
  ForACause = 'for_a_cause',
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
export enum Status4 {
  Pending = 'pending',
  Ready = 'ready',
  Failed = 'failed',
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
export enum ActivityTag {
  Race = 'race',
  LongRun = 'long_run',
  Commute = 'commute',
  Workout = 'workout',
  Competition = 'competition',
  Recovery = 'recovery',
  WithPet = 'with_pet',
  WithKid = 'with_kid',
  ForACause = 'for_a_cause',
}
export enum Type2 {
  ActivityLike = 'activity_like',
  ActivityComment = 'activity_comment',
  FollowRequest = 'follow_request',
}
