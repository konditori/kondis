import type { Insertable, Selectable, Updateable } from 'kysely';
import { ActivityBestEffortTable } from 'src/schema/tables/activity-best-effort.table';
import { ActivityMetricTable } from 'src/schema/tables/activity-metric.table';
import { ActivityStreamTable } from 'src/schema/tables/activity-stream.table';
import { ActivityTable } from 'src/schema/tables/activity.table';
import { LapTable } from 'src/schema/tables/lap.table';
import { UploadTable } from 'src/schema/tables/upload.table';
import { UserTable } from 'src/schema/tables/user.table';

export interface DB {
  user: UserTable;
  upload: UploadTable;
  activity: ActivityTable;
  activity_best_effort: ActivityBestEffortTable;
  activity_metric: ActivityMetricTable;
  activity_stream: ActivityStreamTable;
  activity_route_match: ActivityRouteMatchTable;
  lap: LapTable;
}

export interface ActivityRouteMatchTable {
  activity_id: string;
  matched_activity_id: string;
}

export type Upload = Selectable<UploadTable>;
export type NewUpload = Insertable<UploadTable>;
export type UploadUpdate = Updateable<UploadTable>;

export type Activity = Selectable<ActivityTable>;
export type NewActivity = Insertable<ActivityTable>;
export type ActivityUpdate = Updateable<ActivityTable>;

export type ActivityBestEffort = Selectable<ActivityBestEffortTable>;
export type NewActivityBestEffort = Insertable<ActivityBestEffortTable>;

export type ActivityMetric = Selectable<ActivityMetricTable>;
export type NewActivityMetric = Insertable<ActivityMetricTable>;

export type ActivityStream = Selectable<ActivityStreamTable>;
export type NewActivityStream = Insertable<ActivityStreamTable>;

export type Lap = Selectable<LapTable>;
export type NewLap = Insertable<LapTable>;

export { type StreamType, type UploadStatus } from 'src/types';
