import type { ArgsOf, EmitEvent, RealtimePort } from 'src/ports/realtime.port';

export type DurableObjectNamespaceBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => { fetch: (request: Request | string, init?: RequestInit) => Promise<Response> };
};

type RealtimeConnection = {
  socket: WebSocket;
  scope: 'activity-events' | 'job-events';
  sessionId: string;
  userId: string | null;
  activities: Set<string>;
};

type PublishedEvent = { event: EmitEvent; args: unknown[] };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export class RealtimeDurableObject {
  private readonly connections = new Set<RealtimeConnection>();

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

    const scope = url.searchParams.get('scope');
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');
    if (
      (scope !== 'activity-events' && scope !== 'job-events') ||
      !sessionId ||
      (scope === 'activity-events' && !userId)
    ) {
      return new Response('Unauthorized', { status: 401 });
    }

    const pair = new (
      globalThis as unknown as {
        WebSocketPair: new () => { 0: WebSocket; 1: WebSocket };
      }
    ).WebSocketPair();
    const client = pair[0];
    const socket = pair[1];
    (socket as WebSocket & { accept: () => void }).accept();
    const connection: RealtimeConnection = {
      socket,
      scope,
      sessionId,
      userId,
      activities: new Set(),
    };
    this.connections.add(connection);
    socket.addEventListener('message', (event: MessageEvent) => this.handleMessage(connection, String(event.data)));
    socket.addEventListener('close', () => this.connections.delete(connection));
    socket.addEventListener('error', () => this.connections.delete(connection));
    socket.send(JSON.stringify({ type: 'connected' }));
    return new Response(null, { status: 101, webSocket: client } as ResponseInit & { webSocket: WebSocket });
  }

  private async publish(request: Request): Promise<Response> {
    let event: PublishedEvent;
    try {
      const value: unknown = await request.json();
      if (!isObject(value) || typeof value.event !== 'string' || !Array.isArray(value.args)) {
        return new Response('Bad Request', { status: 400 });
      }
      event = { event: value.event as EmitEvent, args: value.args };
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    for (const connection of this.connections) {
      if (this.shouldReceive(connection, event)) {
        connection.socket.send(JSON.stringify(this.serialize(event)));
      }
    }
    return new Response(null, { status: 204 });
  }

  private handleMessage(connection: RealtimeConnection, message: string): void {
    try {
      const value: unknown = JSON.parse(message);
      if (!isObject(value) || typeof value.type !== 'string' || typeof value.activityId !== 'string') {
        return;
      }
      if (connection.scope !== 'activity-events' || !/^[\da-f-]{36}$/i.test(value.activityId)) {
        return;
      }
      if (value.type === 'activity.subscribe') {
        connection.activities.add(value.activityId);
      } else if (value.type === 'activity.unsubscribe') {
        connection.activities.delete(value.activityId);
      }
    } catch {
      // Ignore malformed and forward-incompatible client messages.
    }
  }

  private shouldReceive(connection: RealtimeConnection, event: PublishedEvent): boolean {
    if (event.event === 'JobUpdated') {
      return connection.scope === 'job-events';
    }
    if (event.event === 'SessionRevoked') {
      return event.args[0] === connection.sessionId;
    }
    if (event.event === 'NotificationCreated') {
      const notification = event.args[0];
      return isObject(notification) && notification.recipientId === connection.userId;
    }
    if (event.event === 'NotificationsRead') {
      const notification = event.args[0];
      return isObject(notification) && notification.userId === connection.userId;
    }
    if (connection.scope !== 'activity-events') {
      return false;
    }
    const activityId = this.activityId(event.args[0]);
    if (activityId !== undefined && connection.activities.has(activityId)) {
      return true;
    }
    const ownerId = this.activityOwnerId(event.args[0]);
    return ownerId !== undefined && ownerId === connection.userId;
  }

  private activityId(value: unknown): string | undefined {
    if (!isObject(value)) {
      return undefined;
    }
    if (typeof value.id === 'string') {
      return value.id;
    }
    return isObject(value.activity) && typeof value.activity.id === 'string' ? value.activity.id : undefined;
  }

  private activityOwnerId(value: unknown): string | undefined {
    if (!isObject(value)) {
      return undefined;
    }
    if (typeof value.userId === 'string') {
      return value.userId;
    }
    return isObject(value.athlete) && typeof value.athlete.id === 'string' ? value.athlete.id : undefined;
  }

  private serialize({ event, args }: PublishedEvent): unknown {
    switch (event) {
      case 'SessionRevoked': {
        return { type: 'session.revoked', sessionId: args[0] };
      }
      case 'JobUpdated': {
        return { type: 'job.updated' };
      }
      case 'ActivityCreate': {
        return { type: 'activity.created', activity: args[0] };
      }
      case 'ActivityUploadSkipped': {
        return { type: 'activity.upload.skipped', activity: args[0], uploadFileName: args[1] };
      }
      case 'ActivityUpdate': {
        return { type: 'activity.updated', activity: args[0] };
      }
      case 'ActivityCommentCreated': {
        return { type: 'activity.comment.created', activity: args[0], comment: args[1] };
      }
      case 'ActivityCommentUpdated': {
        return { type: 'activity.comment.updated', activity: args[0], comment: args[1] };
      }
      case 'ActivityCommentDeleted': {
        return { type: 'activity.comment.deleted', activity: args[0], commentId: args[1] };
      }
      case 'ActivityLikeUpdated': {
        return { type: 'activity.like.updated', activity: args[0] };
      }
      case 'ActivityBestEffortsAvailable': {
        return { type: 'activity.best-efforts.available', activity: args[0] };
      }
      case 'NotificationCreated': {
        return { type: 'notification.created', notification: args[0] };
      }
      case 'NotificationsRead': {
        return { type: 'notifications.read', ...(args[0] as object) };
      }
    }
  }
}

export class DurableObjectRealtimeAdapter implements RealtimePort {
  constructor(private readonly namespace: DurableObjectNamespaceBinding) {}

  async emit<T extends EmitEvent>(event: T, ...args: ArgsOf<T>): Promise<void> {
    try {
      const id = this.namespace.idFromName('global');
      const response = await this.namespace.get(id).fetch('https://realtime.internal/publish', {
        method: 'POST',
        body: JSON.stringify({ event, args }),
      });
      if (!response.ok) {
        throw new Error(`Realtime Durable Object returned ${response.status}`);
      }
    } catch (error) {
      // Realtime is best effort. A delivery outage must not roll back or turn
      // a successful database mutation into an API failure.
      console.warn(`Realtime event ${event} was not delivered`, error);
    }
  }
}

export const noopRealtime: RealtimePort = { emit: async () => {} };
