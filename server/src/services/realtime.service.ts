import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import type { Server } from 'node:http';
import pg from 'pg';
import { WebSocket, WebSocketServer } from 'ws';

import { ConfigService } from 'src/config/config.service';
import { REALTIME_CHANNEL } from 'src/repositories/database.repository';

@Injectable()
export class RealtimeService implements OnApplicationShutdown {
  private readonly logger = new Logger(RealtimeService.name);
  private listener?: pg.Client;
  private reconnectTimer?: NodeJS.Timeout;
  private socketServer?: WebSocketServer;
  private stopped = false;

  constructor(private readonly config: ConfigService) {}

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
      this.logger.error(`Realtime database listener failed: ${error.message}`);
      this.scheduleReconnect(listener);
    });
    listener.once('end', () => this.scheduleReconnect(listener));
    await listener.connect();
    await listener.query(`LISTEN ${REALTIME_CHANNEL}`);
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
          `Could not reconnect realtime listener: ${error instanceof Error ? error.message : String(error)}`,
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
