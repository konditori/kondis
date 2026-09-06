import type { ActivityDetailDto, ActivityDto } from 'src/dtos/activity.dto';
import type { ActivityCommentEvent, ArgsOf, EmitEvent, NotificationCreatedEvent } from 'src/ports/realtime.port';

export type WebsocketEvent =
  | { type: 'session.revoked'; sessionId: string }
  | { type: 'job.updated' }
  | { type: 'activity.created' | 'activity.updated'; activity: ActivityDto }
  | { type: 'activity.upload.skipped'; activity: Pick<ActivityDto, 'id' | 'name' | 'sport'>; uploadFileName: string }
  | {
      type: 'activity.comment.created' | 'activity.comment.updated';
      activity: Pick<ActivityDto, 'id'>;
      comment: ActivityCommentEvent;
    }
  | { type: 'activity.comment.deleted'; activity: Pick<ActivityDto, 'id'>; commentId: string }
  | { type: 'activity.like.updated'; activity: { id: string; likeCount: number } }
  | { type: 'activity.best-efforts.available'; activity: Pick<ActivityDetailDto, 'id' | 'bestEfforts'> }
  | { type: 'notification.created'; notification: NotificationCreatedEvent }
  | { type: 'notifications.read'; userId: string; readAt: string };

type EventSerializers = { [T in EmitEvent]: (...args: ArgsOf<T>) => WebsocketEvent };

export const eventSerializers: EventSerializers = {
  SessionRevoked: (sessionId) => ({ type: 'session.revoked', sessionId }),
  JobUpdated: () => ({ type: 'job.updated' }),
  ActivityCreate: (activity) => ({ type: 'activity.created', activity }),
  ActivityUploadSkipped: (activity, uploadFileName) => ({ type: 'activity.upload.skipped', activity, uploadFileName }),
  ActivityUpdate: (activity) => ({ type: 'activity.updated', activity }),
  ActivityCommentCreated: (activity, comment) => ({ type: 'activity.comment.created', activity, comment }),
  ActivityCommentUpdated: (activity, comment) => ({ type: 'activity.comment.updated', activity, comment }),
  ActivityCommentDeleted: (activity, commentId) => ({ type: 'activity.comment.deleted', activity, commentId }),
  ActivityLikeUpdated: (activity) => ({ type: 'activity.like.updated', activity }),
  ActivityBestEffortsAvailable: (activity) => ({ type: 'activity.best-efforts.available', activity }),
  NotificationCreated: (notification) => ({ type: 'notification.created', notification }),
  NotificationsRead: (notification) => ({ type: 'notifications.read', ...notification }),
};

export const serializeRealtimeEvent = <T extends EmitEvent>(event: T, ...args: ArgsOf<T>): WebsocketEvent =>
  (eventSerializers[event] as (...values: ArgsOf<T>) => WebsocketEvent)(...args);

export const isWebsocketEvent = (value: unknown): value is WebsocketEvent => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as Record<string, unknown>;
  if (event.type === 'job.updated') {
    return true;
  }
  if (event.type === 'session.revoked') {
    return typeof event.sessionId === 'string';
  }
  if (event.type === 'notification.created') {
    return typeof event.notification === 'object' && event.notification !== null;
  }
  if (event.type === 'notifications.read') {
    return typeof event.userId === 'string' && typeof event.readAt === 'string';
  }
  if (
    ![
      'activity.created',
      'activity.updated',
      'activity.upload.skipped',
      'activity.comment.created',
      'activity.comment.updated',
      'activity.comment.deleted',
      'activity.like.updated',
      'activity.best-efforts.available',
    ].includes(String(event.type))
  ) {
    return false;
  }
  return (
    typeof event.activity === 'object' &&
    event.activity !== null &&
    typeof (event.activity as { id?: unknown }).id === 'string'
  );
};

export { type NotificationsReadEvent } from 'src/ports/realtime.port';
