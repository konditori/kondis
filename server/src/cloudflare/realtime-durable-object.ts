import { sql } from 'kysely';

import { createHyperdriveDatabase } from 'src/db/hyperdrive';
import type { ArgsOf, EmitEvent, RealtimePort } from 'src/ports/realtime.port';
import { isWebsocketEvent, serializeRealtimeEvent, type WebsocketEvent } from 'src/realtime/protocol';
import { SocialRepository } from 'src/repositories/social.repository';
import type { KondisDatabase } from 'src/types';

export const REALTIME_DURABLE_OBJECT_NAME = 'global';
export const MAX_WEBSOCKET_PAYLOAD_BYTES = 1024;
export const MAX_ACTIVITY_SUBSCRIPTIONS_PER_SOCKET = 100;
export const MAX_ACTIVITY_AUTHORIZATION_ATTEMPTS_PER_SOCKET = 100;
export const MAX_CONCURRENT_ACTIVITY_AUTHORIZATIONS = 8;

export type DurableObjectNamespaceBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request | string, init?: RequestInit) => Promise<Response> };
};

type DurableObjectStateLike = {
  acceptWebSocket: (socket: HibernatableWebSocket) => void;
  getWebSockets: () => HibernatableWebSocket[];
  setAlarm: (scheduledTime: number | Date) => Promise<void>;
};
type HibernatableWebSocket = WebSocket & {
  serializeAttachment: (attachment: SocketAttachment) => void;
  deserializeAttachment: () => unknown;
};
type SocketAttachment = {
  kind: 'user' | 'admin';
  sessionId: string;
  userId: string | null;
  sessionExpiresAt: number;
  activityIds: string[];
  authorizationAttempts: number;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const activityId = (event: WebsocketEvent): string | undefined => ('activity' in event ? event.activity.id : undefined);

/**
 * Global best-effort hub. Socket identity lives in attachments, not memory.
 */
export class RealtimeDurableObject {
  private database?: KondisDatabase;
  private social?: SocialRepository;
  private activeAuthorizations = 0;

  constructor(
    private readonly state: DurableObjectStateLike,
    env: { HYPERDRIVE?: { connectionString: string } },
  ) {
    if (!env.HYPERDRIVE?.connectionString) {
      return;
    }

    this.database = createHyperdriveDatabase(env.HYPERDRIVE.connectionString).db;
    this.social = new SocialRepository(this.database);
  }

  fetch(request: Request): Response | Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/publish' && request.method === 'POST') {
      return this.publish(request);
    }
    if (
      url.pathname !== '/connect' ||
      request.method !== 'GET' ||
      request.headers.get('Upgrade')?.toLowerCase() !== 'websocket'
    ) {
      return new Response('Not Found', { status: 404 });
    }
    return this.connect(url);
  }

  private async connect(url: URL): Promise<Response> {
    const kind = url.searchParams.get('scope') === 'job-events' ? 'admin' : 'user';
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');
    const sessionExpiresAt = Number(url.searchParams.get('sessionExpiresAt'));
    if (!sessionId || !Number.isFinite(sessionExpiresAt) || (kind === 'user' && !userId)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const pair = new (
      globalThis as unknown as { WebSocketPair: new () => { 0: WebSocket; 1: HibernatableWebSocket } }
    ).WebSocketPair();
    const client = pair[0];
    const socket = pair[1];
    socket.serializeAttachment({
      kind,
      sessionId,
      userId: userId ?? null,
      sessionExpiresAt,
      activityIds: [],
      authorizationAttempts: 0,
    });
    this.state.acceptWebSocket(socket);
    await this.scheduleNextExpiry();
    this.send(socket, { type: 'connected' });
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }

  async webSocketMessage(socket: HibernatableWebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > MAX_WEBSOCKET_PAYLOAD_BYTES) {
      return;
    }
    const attachment = this.attachment(socket);
    if (!attachment || attachment.kind !== 'user' || !attachment.userId) {
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(message);
    } catch {
      return;
    }
    if (
      !isObject(value) ||
      (value.type !== 'activity.subscribe' && value.type !== 'activity.unsubscribe') ||
      typeof value.activityId !== 'string' ||
      !/^[\da-f-]{36}$/i.test(value.activityId)
    ) {
      return;
    }
    if (value.type === 'activity.unsubscribe') {
      attachment.activityIds = attachment.activityIds.filter((id) => id !== value.activityId);
      socket.serializeAttachment(attachment);
      return;
    }
    if (
      attachment.activityIds.includes(value.activityId) ||
      attachment.activityIds.length >= MAX_ACTIVITY_SUBSCRIPTIONS_PER_SOCKET ||
      attachment.authorizationAttempts >= MAX_ACTIVITY_AUTHORIZATION_ATTEMPTS_PER_SOCKET ||
      !this.social ||
      this.activeAuthorizations >= MAX_CONCURRENT_ACTIVITY_AUTHORIZATIONS
    ) {
      return;
    }
    attachment.authorizationAttempts += 1;
    socket.serializeAttachment(attachment);
    this.activeAuthorizations += 1;
    try {
      if (await this.social.canViewActivity(value.activityId, attachment.userId)) {
        const current = this.attachment(socket);
        if (
          current &&
          current.activityIds.length < MAX_ACTIVITY_SUBSCRIPTIONS_PER_SOCKET &&
          !current.activityIds.includes(value.activityId)
        ) {
          current.activityIds.push(value.activityId);
          socket.serializeAttachment(current);
        }
      }
    } catch {
      // An unavailable authorization database must not terminate a client.
    } finally {
      this.activeAuthorizations -= 1;
    }
  }

  webSocketClose(): void {}
  webSocketError(): void {}

  async alarm(): Promise<void> {
    const now = Date.now();
    for (const socket of this.state.getWebSockets()) {
      const attachment = this.attachment(socket);
      if (attachment && attachment.sessionExpiresAt <= now) {
        socket.close(1008, 'Session expired');
      }
    }
    await this.scheduleNextExpiry();
  }

  private async publish(request: Request): Promise<Response> {
    let event: WebsocketEvent;
    try {
      event = await request.json();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }
    if (!isWebsocketEvent(event)) {
      return new Response('Bad Request', { status: 400 });
    }
    const recipients = await this.recipients(event);
    for (const socket of this.state.getWebSockets()) {
      const attachment = this.attachment(socket);
      if (attachment && this.shouldReceive(attachment, event, recipients)) {
        this.send(socket, event);
      }
    }
    if (event.type === 'session.revoked') {
      for (const socket of this.state.getWebSockets()) {
        if (this.attachment(socket)?.sessionId === event.sessionId) {
          socket.close(1008, 'Session revoked');
        }
      }
    }
    return new Response(null, { status: 204 });
  }

  private shouldReceive(connection: SocketAttachment, event: WebsocketEvent, recipients: Set<string>): boolean {
    if (event.type === 'job.updated') {
      return connection.kind === 'admin';
    }
    if (event.type === 'session.revoked') {
      return connection.sessionId === event.sessionId;
    }
    if (connection.kind !== 'user' || !connection.userId) {
      return false;
    }
    if (event.type === 'notification.created') {
      return event.notification.recipientId === connection.userId;
    }
    if (event.type === 'notifications.read') {
      return event.userId === connection.userId;
    }
    const id = activityId(event);
    return Boolean(id && (connection.activityIds.includes(id) || recipients.has(connection.userId)));
  }

  private async recipients(event: WebsocketEvent): Promise<Set<string>> {
    const id = activityId(event);
    if (!id || !this.database) {
      return new Set();
    }
    try {
      const activity = await this.database
        .selectFrom('activity')
        .select('user_id')
        .where('id', '=', id)
        .executeTakeFirst();
      if (!activity?.user_id) {
        return new Set();
      }
      const followers = await this.database
        .selectFrom('user_follow')
        .select('follower_id')
        .where('followee_id', '=', activity.user_id)
        .where(
          sql<boolean>`NOT EXISTS (SELECT 1 FROM user_block b WHERE (b.blocker_id = user_follow.follower_id AND b.blocked_id = ${activity.user_id}::uuid) OR (b.blocker_id = ${activity.user_id}::uuid AND b.blocked_id = user_follow.follower_id))`,
        )
        .execute();
      return new Set([activity.user_id, ...followers.map(({ follower_id }) => follower_id)]);
    } catch {
      return new Set();
    }
  }

  private attachment(socket: HibernatableWebSocket): SocketAttachment | undefined {
    const value = socket.deserializeAttachment();
    return isObject(value) &&
      (value.kind === 'user' || value.kind === 'admin') &&
      typeof value.sessionId === 'string' &&
      typeof value.sessionExpiresAt === 'number' &&
      Array.isArray(value.activityIds)
      ? (value as SocketAttachment)
      : undefined;
  }
  private send(socket: WebSocket, event: unknown): void {
    try {
      socket.send(JSON.stringify(event));
    } catch {
      try {
        socket.close(1011, 'Send failed');
      } catch {
        // Closing an already-closed socket is harmless.
      }
    }
  }
  private async scheduleNextExpiry(): Promise<void> {
    const expiries = this.state
      .getWebSockets()
      .map((socket) => this.attachment(socket)?.sessionExpiresAt)
      .filter((value): value is number => value !== undefined);
    if (expiries.length > 0) {
      await this.state.setAlarm(Math.min(...expiries));
    }
  }
}

export class DurableObjectRealtimeAdapter implements RealtimePort {
  constructor(private readonly namespace: DurableObjectNamespaceBinding) {}
  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    try {
      const response = await this.namespace
        .get(this.namespace.idFromName(REALTIME_DURABLE_OBJECT_NAME))
        .fetch('https://realtime.internal/publish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(serializeRealtimeEvent(event, ...args)),
        });
      if (!response.ok) {
        throw new Error(`Realtime Durable Object returned ${response.status}`);
      }
    } catch (error) {
      console.warn(`Realtime event ${event} was not delivered`, error);
    }
  }
}

export const noopRealtime: RealtimePort = { emit: async () => {} };
