import type { Insertable, Selectable, Updateable } from 'kysely';
import { ActivityMetricTable } from 'src/schema/tables/activity-metric.table';
import { ActivityStreamTable } from 'src/schema/tables/activity-stream.table';
import { ActivityTable } from 'src/schema/tables/activity.table';
import { LapTable } from 'src/schema/tables/lap.table';
import { UploadTable } from 'src/schema/tables/upload.table';

export interface DB {
  upload: UploadTable;
  activity: ActivityTable;
  activity_metric: ActivityMetricTable;
  activity_stream: ActivityStreamTable;
  lap: LapTable;
}

export type Upload = Selectable<UploadTable>;
export type NewUpload = Insertable<UploadTable>;
export type UploadUpdate = Updateable<UploadTable>;

export type Activity = Selectable<ActivityTable>;
export type NewActivity = Insertable<ActivityTable>;
export type ActivityUpdate = Updateable<ActivityTable>;

export type ActivityMetric = Selectable<ActivityMetricTable>;
export type NewActivityMetric = Insertable<ActivityMetricTable>;

export type ActivityStream = Selectable<ActivityStreamTable>;
export type NewActivityStream = Insertable<ActivityStreamTable>;

export type Lap = Selectable<LapTable>;
export type NewLap = Insertable<LapTable>;

export { type StreamType, type UploadStatus } from 'src/types';
