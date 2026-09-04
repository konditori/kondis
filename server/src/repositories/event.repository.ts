import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'kysely';
import type { Server } from 'node:http';
import pg from 'pg';
import { WebSocket, WebSocketServer } from 'ws';

import { AUTH_SECRET, verifyActivityEventsTicket, verifyJobEventsTicket } from 'src/auth';
import { KYSELY } from 'src/db/database';
import type { ActivityDetailDto, ActivityDto } from 'src/dtos/activity.dto';
import type {
  ActivityCommentEvent,
  ArgsOf,
  EmitEvent,
  NotificationCreatedEvent,
  RealtimePort,
} from 'src/ports/realtime.port';
import { ConfigRepository } from 'src/repositories/config.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import type { KondisDatabase } from 'src/types';

export type { ActivityCommentEvent } from 'src/ports/realtime.port';

const EVENT_CHANNEL = 'kondis_realtime';
const EVENT_PATHS = new Set(['/events', '/api/v1/events']);
const JOB_UPDATE_INTERVAL_MS = 250;

type WebsocketEvent =
  | { type: 'job.updated' }
  | { type: 'activity.created' | 'activity.updated'; activity: ActivityDto }
  | {
      type: 'activity.upload.skipped';
      activity: Pick<ActivityDto, 'id' | 'name' | 'sport'>;
      uploadFileName: string;
    }
  | { type: 'activity.comment.created'; activity: Pick<ActivityDto, 'id'>; comment: ActivityCommentEvent }
  | { type: 'activity.comment.updated'; activity: Pick<ActivityDto, 'id'>; comment: ActivityCommentEvent }
  | { type: 'activity.comment.deleted'; activity: Pick<ActivityDto, 'id'>; commentId: string }
  | { type: 'activity.like.updated'; activity: { id: string; likeCount: number } }
  | { type: 'activity.best-efforts.available'; activity: Pick<ActivityDetailDto, 'id' | 'bestEfforts'> }
  | { type: 'notification.created'; notification: NotificationCreatedEvent }
  | { type: 'notifications.read'; userId: string; readAt: string };

type EventSerializers = {
  [T in EmitEvent]: (...args: ArgsOf<T>) => WebsocketEvent;
};

const eventSerializers: EventSerializers = {
  JobUpdated: () => ({ type: 'job.updated' }),
  ActivityCreate: (activity) => ({ type: 'activity.created', activity }),
  ActivityUploadSkipped: (activity, uploadFileName) => ({
    type: 'activity.upload.skipped',
    activity,
    uploadFileName,
  }),
  ActivityUpdate: (activity) => ({ type: 'activity.updated', activity }),
  ActivityCommentCreated: (activity, comment) => ({ type: 'activity.comment.created', activity, comment }),
  ActivityCommentUpdated: (activity, comment) => ({ type: 'activity.comment.updated', activity, comment }),
  ActivityCommentDeleted: (activity, commentId) => ({ type: 'activity.comment.deleted', activity, commentId }),
  ActivityLikeUpdated: (activity) => ({ type: 'activity.like.updated', activity }),
  ActivityBestEffortsAvailable: (activity) => ({ type: 'activity.best-efforts.available', activity }),
  NotificationCreated: (notification) => ({ type: 'notification.created', notification }),
  NotificationsRead: (notification) => ({ type: 'notifications.read', ...notification }),
};

@Injectable()
export class EventRepository implements OnApplicationShutdown, RealtimePort {
  private readonly logger = new Logger(EventRepository.name);
  private listener?: pg.Client;
  private reconnectTimer?: NodeJS.Timeout;
  private jobUpdateTimer?: NodeJS.Timeout;
  private socketServer?: WebSocketServer;
  private httpServer?: Server;
  private upgradeHandler?: Parameters<Server['on']>[1];
  private readonly socketUsers = new Map<WebSocket, string>();
  private readonly socketActivities = new Map<WebSocket, Set<string>>();
  private readonly jobDashboardSockets = new Set<WebSocket>();
  private stopped = false;

  constructor(
    @Inject(KYSELY) private readonly db: KondisDatabase,
    private readonly config: ConfigRepository,
    private readonly social: SocialRepository,
  ) {}

  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    if (event === 'JobUpdated') {
      this.scheduleJobUpdate();
      return;
    }

    await this.publish(event, ...args);
  }

  private async publish<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    const serialize = eventSerializers[event] as (...values: ArgsOf<T>) => WebsocketEvent;
    const payload = JSON.stringify(serialize(...args));
    await sql`SELECT pg_notify(${EVENT_CHANNEL}, ${payload})`.execute(this.db);
  }

  private scheduleJobUpdate(): void {
    if (this.stopped || this.jobUpdateTimer) {
      return;
    }
    this.jobUpdateTimer = setTimeout(() => {
      this.jobUpdateTimer = undefined;
      void this.publish('JobUpdated').catch((error: unknown) => {
        this.logger.warn(`Could not publish job update: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, JOB_UPDATE_INTERVAL_MS);
  }

  async attach(server: Server): Promise<void> {
    this.socketServer = new WebSocketServer({ noServer: true });
    this.httpServer = server;
    this.upgradeHandler = (request, socket, head) => {
      const path = new URL(request.url ?? '', 'http://localhost').pathname;
      if (!EVENT_PATHS.has(path)) {
        return;
      }
      this.socketServer?.handleUpgrade(request, socket, head, (client) => {
        this.socketServer?.emit('connection', client, request);
      });
    };
    server.on('upgrade', this.upgradeHandler);
    this.socketServer.on('connection', (socket, request) => {
      const ticket = new URL(request.url ?? '', 'http://localhost').searchParams.get('ticket');
      const userId = verifyActivityEventsTicket(ticket, AUTH_SECRET);
      const isJobDashboard = !userId && Boolean(verifyJobEventsTicket(ticket, AUTH_SECRET));
      if (!userId && !isJobDashboard) {
        socket.close(1008, 'Authentication required');
        return;
      }
      if (userId) {
        this.socketUsers.set(socket, userId);
      }
      if (isJobDashboard) {
        this.jobDashboardSockets.add(socket);
      }
      this.socketActivities.set(socket, new Set());
      if (userId) {
        socket.on('message', (message) => void this.subscribeToActivity(socket, userId, String(message)));
      }
      socket.once('close', () => {
        this.socketUsers.delete(socket);
        this.socketActivities.delete(socket);
        this.jobDashboardSockets.delete(socket);
      });
      socket.send(JSON.stringify({ type: 'connected' }));
    });

    await this.connectListener();
    this.logger.log('Activity events available at /events and /api/v1/events');
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.jobUpdateTimer);
    if (this.httpServer && this.upgradeHandler) {
      this.httpServer.off('upgrade', this.upgradeHandler);
    }
    this.socketServer?.close();
    this.socketUsers.clear();
    this.socketActivities.clear();
    this.jobDashboardSockets.clear();
    await this.listener?.end();
  }

  private async connectListener(): Promise<void> {
    const listener = new pg.Client(this.config.database);
    this.listener = listener;
    listener.on('notification', ({ payload }) => {
      if (payload) {
        void this.broadcast(payload);
      }
    });
    listener.once('error', (error) => {
      this.logger.error(`Event database listener failed: ${error.message}`);
      this.scheduleReconnect(listener);
    });
    listener.once('end', () => this.scheduleReconnect(listener));
    await listener.connect();
    await listener.query(`LISTEN ${EVENT_CHANNEL}`);
  }

  private scheduleReconnect(listener: pg.Client): void {
    if (this.stopped || this.listener !== listener || this.reconnectTimer) {
      return;
    }

    this.listener = undefined;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectListener().catch((error: unknown) => {
        this.logger.error(
          `Could not reconnect event listener: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.scheduleReconnect(this.listener!);
      });
    }, 1000);
  }

  private async broadcast(payload: string): Promise<void> {
    if (this.isJobUpdate(payload)) {
      for (const client of this.jobDashboardSockets) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
      return;
    }
    const commentActivityId = this.commentActivityId(payload);
    if (commentActivityId) {
      const recipients = await this.recipientsFor(payload);
      for (const client of this.socketServer?.clients ?? []) {
        const subscribed = this.socketActivities.get(client)?.has(commentActivityId) ?? false;
        const isRecipient = recipients.has(this.socketUsers.get(client) ?? '');
        if (client.readyState === WebSocket.OPEN && (subscribed || isRecipient)) {
          client.send(payload);
        }
      }
      return;
    }
    const recipients = await this.recipientsFor(payload);
    if (recipients.size === 0) {
      return;
    }
    for (const client of this.socketServer?.clients ?? []) {
      if (client.readyState === WebSocket.OPEN && recipients.has(this.socketUsers.get(client) ?? '')) {
        client.send(payload);
      }
    }
  }

  private isJobUpdate(payload: string): boolean {
    try {
      return (JSON.parse(payload) as { type?: string }).type === 'job.updated';
    } catch {
      return false;
    }
  }

  private async recipientsFor(payload: string): Promise<Set<string>> {
    try {
      const event = JSON.parse(payload) as {
        type?: string;
        notification?: { recipientId?: string };
        userId?: string;
        activity?: { id?: string };
      };
      if (event.type === 'notification.created' && event.notification?.recipientId) {
        return new Set([event.notification.recipientId]);
      }
      if (event.type === 'notifications.read' && event.userId) {
        return new Set([event.userId]);
      }
      const activityId = event.activity?.id;
      if (!activityId) {
        return new Set();
      }
      const activity = await this.db
        .selectFrom('activity')
        .select('user_id')
        .where('id', '=', activityId)
        .executeTakeFirst();
      if (!activity?.user_id) {
        return new Set();
      }
      const followers = await this.db
        .selectFrom('user_follow')
        .select('follower_id')
        .where('followee_id', '=', activity.user_id)
        .where(
          sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = user_follow.follower_id AND b.blocked_id = ${activity.user_id}::uuid) OR (b.blocker_id = ${activity.user_id}::uuid AND b.blocked_id = user_follow.follower_id))`,
        )
        .execute();
      return new Set([activity.user_id, ...followers.map(({ follower_id }) => follower_id)]);
    } catch (error) {
      this.logger.warn(`Could not route activity event: ${error instanceof Error ? error.message : String(error)}`);
      return new Set();
    }
  }

  private async subscribeToActivity(socket: WebSocket, userId: string, message: string): Promise<void> {
    try {
      const subscription = JSON.parse(message) as {
        type?: string;
        activityId?: string;
      };
      if (subscription.type !== 'activity.subscribe' || !subscription.activityId) {
        return;
      }
      if (!(await this.social.canViewActivity(subscription.activityId, userId))) {
        return;
      }
      this.socketActivities.get(socket)?.add(subscription.activityId);
    } catch {
      // Ignore malformed client messages.
    }
  }

  private commentActivityId(payload: string): string | undefined {
    try {
      const event = JSON.parse(payload) as {
        type?: string;
        activity?: { id?: string };
      };
      return event.type?.startsWith('activity.comment.') ? event.activity?.id : undefined;
    } catch {
      return undefined;
    }
  }
}
