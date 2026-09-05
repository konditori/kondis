import type { ActivityDetailDto, ActivityDto } from 'src/dtos/activity.dto';

export type ActivityCommentEvent = {
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

export type NotificationCreatedEvent = {
  recipientId: string;
  id: string;
  type: 'activity_like' | 'activity_comment' | 'follow_request';
  createdAt: string;
  activityId: string | null;
};

export type NotificationsReadEvent = {
  userId: string;
  readAt: string;
};

export type EventMap = {
  SessionRevoked: [sessionId: string];
  JobUpdated: [];
  ActivityCreate: [activity: ActivityDto];
  ActivityUploadSkipped: [activity: Pick<ActivityDto, 'id' | 'name' | 'sport'>, uploadFileName: string];
  ActivityUpdate: [activity: ActivityDto];
  ActivityCommentCreated: [activity: Pick<ActivityDto, 'id'>, comment: ActivityCommentEvent];
  ActivityCommentUpdated: [activity: Pick<ActivityDto, 'id'>, comment: ActivityCommentEvent];
  ActivityCommentDeleted: [activity: Pick<ActivityDto, 'id'>, commentId: string];
  ActivityLikeUpdated: [activity: { id: string; likeCount: number }];
  ActivityBestEffortsAvailable: [activity: Pick<ActivityDetailDto, 'id' | 'bestEfforts'>];
  NotificationCreated: [notification: NotificationCreatedEvent];
  NotificationsRead: [notification: NotificationsReadEvent];
};

export type EmitEvent = keyof EventMap;
export type ArgsOf<T extends EmitEvent> = EventMap[T];

export type RealtimePort = {
  emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void>;
};
