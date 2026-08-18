import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'kysely';
import type { Server } from 'node:http';
import pg from 'pg';
import { WebSocket, WebSocketServer } from 'ws';

import { verifyActivityEventsTicket } from 'src/auth';
import { ConfigService } from 'src/config/config.service';
import { KYSELY, KondisDatabase } from 'src/db/database';
import type { ActivityDetailDto, ActivityDto } from 'src/dtos/activity.dto';
import { SocialRepository } from 'src/repositories/social.repository';

const EVENT_CHANNEL = 'kondis_realtime';

type EventMap = {
  ActivityCreate: [activity: ActivityDto];
  ActivityUpdate: [activity: ActivityDto];
  ActivityCommentCreated: [activity: Pick<ActivityDto, 'id'>];
  ActivityBestEffortsAvailable: [activity: Pick<ActivityDetailDto, 'id' | 'bestEfforts'>];
  NotificationCreated: [notification: NotificationCreatedEvent];
  NotificationsRead: [notification: NotificationsReadEvent];
};

type NotificationCreatedEvent = {
  recipientId: string;
  id: string;
  type: 'activity_like' | 'activity_comment' | 'follow_request';
  createdAt: string;
  activityId: string | null;
};

type NotificationsReadEvent = {
  userId: string;
  readAt: string;
};

export type EmitEvent = keyof EventMap;
export type ArgsOf<T extends EmitEvent> = EventMap[T];

type WebsocketEvent =
  | { type: 'activity.created' | 'activity.updated'; activity: ActivityDto }
  | { type: 'activity.comment.created'; activity: Pick<ActivityDto, 'id'> }
  | { type: 'activity.best-efforts.available'; activity: Pick<ActivityDetailDto, 'id' | 'bestEfforts'> }
  | { type: 'notification.created'; notification: NotificationCreatedEvent }
  | { type: 'notifications.read'; userId: string; readAt: string };

type EventSerializers = {
  [T in EmitEvent]: (...args: ArgsOf<T>) => WebsocketEvent;
};

const eventSerializers: EventSerializers = {
  ActivityCreate: (activity) => ({ type: 'activity.created', activity }),
  ActivityUpdate: (activity) => ({ type: 'activity.updated', activity }),
  ActivityCommentCreated: (activity) => ({ type: 'activity.comment.created', activity }),
  ActivityBestEffortsAvailable: (activity) => ({ type: 'activity.best-efforts.available', activity }),
  NotificationCreated: (notification) => ({ type: 'notification.created', notification }),
  NotificationsRead: (notification) => ({ type: 'notifications.read', ...notification }),
};

@Injectable()
export class EventRepository implements OnApplicationShutdown {
  private readonly logger = new Logger(EventRepository.name);
  private listener?: pg.Client;
  private reconnectTimer?: NodeJS.Timeout;
  private socketServer?: WebSocketServer;
  private readonly socketUsers = new Map<WebSocket, string>();
  private readonly socketActivities = new Map<WebSocket, Set<string>>();
  private stopped = false;

  constructor(
    @Inject(KYSELY) private readonly db: KondisDatabase,
    private readonly config: ConfigService,
    private readonly social: SocialRepository,
  ) {}

  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    const serialize = eventSerializers[event] as (...values: ArgsOf<T>) => WebsocketEvent;
    const payload = JSON.stringify(serialize(...args));
    await sql`SELECT pg_notify(${EVENT_CHANNEL}, ${payload})`.execute(this.db);
  }

  async attach(server: Server): Promise<void> {
    this.socketServer = new WebSocketServer({ server, path: '/events' });
    this.socketServer.on('connection', (socket, request) => {
      const ticket = new URL(request.url ?? '', 'http://localhost').searchParams.get('ticket');
      const userId = verifyActivityEventsTicket(ticket, this.config.authSecret);
      if (!userId) {
        socket.close(1008, 'Authentication required');
        return;
      }
      this.socketUsers.set(socket, userId);
      this.socketActivities.set(socket, new Set());
      socket.on('message', (message) => void this.subscribeToActivity(socket, userId, String(message)));
      socket.once('close', () => {
        this.socketUsers.delete(socket);
        this.socketActivities.delete(socket);
      });
      socket.send(JSON.stringify({ type: 'connected' }));
    });

    await this.connectListener();
    this.logger.log('Activity events available at /events');
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.socketServer?.close();
    this.socketUsers.clear();
    this.socketActivities.clear();
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
    const commentActivityId = this.commentActivityId(payload);
    if (commentActivityId) {
      for (const client of this.socketServer?.clients ?? []) {
        if (client.readyState === WebSocket.OPEN && this.socketActivities.get(client)?.has(commentActivityId)) {
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
      return event.type === 'activity.comment.created' ? event.activity?.id : undefined;
    } catch {
      return undefined;
    }
  }
}
