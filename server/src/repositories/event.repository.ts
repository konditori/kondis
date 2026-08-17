import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { sql } from 'kysely';
import type { Server } from 'node:http';
import pg from 'pg';
import { WebSocket, WebSocketServer } from 'ws';

import { ConfigService } from 'src/config/config.service';
import { KYSELY, KondisDatabase } from 'src/db/database';
import type { ActivityDto } from 'src/dtos/activity.dto';

const EVENT_CHANNEL = 'kondis_realtime';

type EventMap = {
  ActivityCreate: [activity: ActivityDto];
  ActivityUpdate: [activity: ActivityDto];
};

export type EmitEvent = keyof EventMap;
export type ArgsOf<T extends EmitEvent> = EventMap[T];

type WebsocketEvent = {
  type: 'activity.created' | 'activity.updated';
  activity: ActivityDto;
};

type EventSerializers = {
  [T in EmitEvent]: (...args: ArgsOf<T>) => WebsocketEvent;
};

const eventSerializers: EventSerializers = {
  ActivityCreate: (activity) => ({ type: 'activity.created', activity }),
  ActivityUpdate: (activity) => ({ type: 'activity.updated', activity }),
};

@Injectable()
export class EventRepository implements OnApplicationShutdown {
  private readonly logger = new Logger(EventRepository.name);
  private listener?: pg.Client;
  private reconnectTimer?: NodeJS.Timeout;
  private socketServer?: WebSocketServer;
  private stopped = false;

  constructor(
    @Inject(KYSELY) private readonly db: KondisDatabase,
    private readonly config: ConfigService,
  ) {}

  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    // SAFETY: eventSerializers is keyed by every EmitEvent and each serializer accepts that event's argument tuple.
    const serialize = eventSerializers[event] as (...values: ArgsOf<T>) => WebsocketEvent;
    const payload = JSON.stringify(serialize(...args));
    await sql`SELECT pg_notify(${EVENT_CHANNEL}, ${payload})`.execute(this.db);
  }

  async attach(server: Server): Promise<void> {
    this.socketServer = new WebSocketServer({ server, path: '/events' });
    this.socketServer.on('connection', (socket) => socket.send(JSON.stringify({ type: 'connected' })));

    await this.connectListener();
    this.logger.log('Activity events available at /events');
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.socketServer?.close();
    await this.listener?.end();
  }

  private async connectListener(): Promise<void> {
    const listener = new pg.Client(this.config.database);
    this.listener = listener;
    listener.on('notification', ({ payload }) => {
      if (payload) {
        this.broadcast(payload);
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
      void this.connectListener().catch((error) => {
        this.logger.error(
          `Could not reconnect event listener: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.scheduleReconnect(this.listener!);
      });
    }, 1000);
  }

  private broadcast(payload: string): void {
    for (const client of this.socketServer?.clients ?? []) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}
