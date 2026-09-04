import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';

import { describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';

import type { AuthCredentialRepository } from 'src/repositories/auth-credential.repository';
import type { ConfigRepository } from 'src/repositories/config.repository';
import { EventRepository } from 'src/repositories/event.repository';
import type { SocialRepository } from 'src/repositories/social.repository';
import type { KondisDatabase } from 'src/types';

const USER_ID = '8300a315-5101-4bbf-8813-6244965ed9b5';
const ACTIVITY_ID = '77d8c0b4-5d9b-44df-8676-8a15abf27d50';
const ACTIVITY_TICKET = 'activity-ticket';

type TestableEventRepository = {
  activeActivityAuthorizations: number;
  activityAuthorizationAttempts: Map<WebSocket, number>;
  activityAuthorizationQueue: unknown[];
  pendingActivitySubscriptions: Set<WebSocket>;
  socketActivities: Map<WebSocket, Set<string>>;
  socketSessions: Map<WebSocket, string>;
  socketServer?: WebSocketServer;
  broadcast(payload: string): Promise<void>;
  validateSocketSessions(): Promise<void>;
  handleConnection(socket: WebSocket, auth: { jobDashboard: boolean; sessionId: string; userId?: string }): void;
  subscribeToActivity(socket: WebSocket, userId: string, message: string): Promise<void>;
};

type CanViewActivity = (...args: Parameters<SocialRepository['canViewActivity']>) => Promise<unknown>;

const findActiveSessionIds = vi.fn((sessionIds: string[]) => Promise.resolve(new Set(sessionIds)));
const credentials = {
  findEventTicket: () => Promise.resolve({ scope: 'activity-events', sessionId: 'session-id', userId: USER_ID }),
  findActiveSessionIds,
} as unknown as AuthCredentialRepository;

const setup = (
  canViewActivity: CanViewActivity = vi.fn(() => Promise.resolve({ id: ACTIVITY_ID, user_id: USER_ID })),
) => {
  const repository = new EventRepository(
    {} as KondisDatabase,
    { database: {} } as ConfigRepository,
    { canViewActivity } as unknown as SocialRepository,
    credentials,
  );
  const testable = repository as unknown as TestableEventRepository;
  const socket = {} as WebSocket;
  const subscriptions = new Set<string>();
  testable.socketActivities.set(socket, subscriptions);
  return { canViewActivity, repository, socket, subscriptions, testable };
};

vi.mock('pg', () => ({
  default: {
    Client: class extends EventEmitter {
      connect(): Promise<void> {
        return Promise.resolve();
      }

      query(): Promise<void> {
        return Promise.resolve();
      }

      end(): Promise<void> {
        return Promise.resolve();
      }
    },
  },
}));

describe(EventRepository.name, () => {
  it('destroys upgrade sockets for unmatched paths', async () => {
    const server = createServer();
    const repository = new EventRepository(
      {} as KondisDatabase,
      { database: {} } as ConfigRepository,
      {} as SocialRepository,
      credentials,
    );
    const socket = { destroy: vi.fn() };
    await repository.attach(server);

    server.emit('upgrade', { url: '/not-events' }, socket, Buffer.alloc(0));

    expect(socket.destroy).toHaveBeenCalledOnce();
    await repository.stop();
  });

  it('limits WebSocket messages to one KiB', async () => {
    const { repository, testable } = setup();
    const server = createServer();

    await repository.attach(server);

    expect(testable.socketServer?.options.maxPayload).toBe(1024);
    await repository.stop();
  });

  it('closes sockets when their session is revoked', async () => {
    const { testable } = setup();
    const socket = { close: vi.fn() } as unknown as WebSocket;
    testable.socketSessions.set(socket, 'revoked-session');

    await testable.broadcast(JSON.stringify({ type: 'session.revoked', sessionId: 'revoked-session' }));

    expect(socket.close).toHaveBeenCalledWith(1008, 'Session revoked');
  });

  it('closes sockets whose database session is no longer active', async () => {
    const { testable } = setup();
    const socket = { close: vi.fn() } as unknown as WebSocket;
    testable.socketSessions.set(socket, 'expired-session');
    findActiveSessionIds.mockResolvedValueOnce(new Set());

    await testable.validateSocketSessions();

    expect(socket.close).toHaveBeenCalledWith(1008, 'Session expired');
  });

  it('closes an oversized frame with 1009 without an uncaught socket error', async () => {
    const { repository } = setup();
    const server = createServer();
    await repository.attach(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected HTTP server to listen on a TCP port');
    }
    const client = new WebSocket(`ws://127.0.0.1:${address.port}/events?ticket=${ACTIVITY_TICKET}`);

    try {
      await new Promise<void>((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
      });
      const closed = new Promise<number>((resolve, reject) => {
        client.once('close', resolve);
        client.once('error', reject);
      });
      client.send(Buffer.alloc(1025));

      await expect(closed).resolves.toBe(1009);
    } finally {
      client.terminate();
      await repository.stop();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('ignores malformed subscriptions before authorization', async () => {
    const { canViewActivity, socket, subscriptions, testable } = setup();

    await testable.subscribeToActivity(socket, USER_ID, 'not json');
    await testable.subscribeToActivity(
      socket,
      USER_ID,
      JSON.stringify({ type: 'activity.subscribe', activityId: 'not-a-uuid' }),
    );
    await testable.subscribeToActivity(
      socket,
      USER_ID,
      JSON.stringify({ type: 'unexpected', activityId: ACTIVITY_ID }),
    );

    expect(canViewActivity).not.toHaveBeenCalled();
    expect(subscriptions.size).toBe(0);
  });

  it('allows only one in-flight authorization check per socket and clears pending state', async () => {
    const authorization = Promise.withResolvers<{ id: string; user_id: string }>();
    const canViewActivity = vi.fn(() => authorization.promise);
    const { socket, subscriptions, testable } = setup(canViewActivity);
    const secondActivityId = 'ae28456f-e5ed-44b2-9279-d9c36927d58e';

    const first = testable.subscribeToActivity(
      socket,
      USER_ID,
      JSON.stringify({ type: 'activity.subscribe', activityId: ACTIVITY_ID }),
    );
    const flooded = testable.subscribeToActivity(
      socket,
      USER_ID,
      JSON.stringify({ type: 'activity.subscribe', activityId: secondActivityId }),
    );

    expect(canViewActivity).toHaveBeenCalledOnce();
    expect(testable.pendingActivitySubscriptions.has(socket)).toBe(true);
    authorization.resolve({ id: ACTIVITY_ID, user_id: USER_ID });
    await Promise.all([first, flooded]);

    expect(subscriptions).toEqual(new Set([ACTIVITY_ID]));
    expect(testable.pendingActivitySubscriptions.has(socket)).toBe(false);
  });

  it('clears pending subscription state when the socket closes', async () => {
    const authorization = Promise.withResolvers<{ id: string; user_id: string }>();
    const { repository, testable } = setup(vi.fn(() => authorization.promise));
    const server = createServer();
    const socket = Object.assign(new EventEmitter(), { close: vi.fn(), send: vi.fn() }) as unknown as WebSocket;
    await repository.attach(server);
    testable.handleConnection(socket, { jobDashboard: false, sessionId: 'session-id', userId: USER_ID });

    socket.emit('message', JSON.stringify({ type: 'activity.subscribe', activityId: ACTIVITY_ID }));
    expect(testable.pendingActivitySubscriptions.has(socket)).toBe(true);

    socket.emit('close');
    expect(testable.pendingActivitySubscriptions.has(socket)).toBe(false);
    expect(testable.socketActivities.has(socket)).toBe(false);
    expect(testable.activityAuthorizationAttempts.has(socket)).toBe(false);

    authorization.resolve({ id: ACTIVITY_ID, user_id: USER_ID });
    await authorization.promise;
    await repository.stop();
  });

  it('bounds subscriptions without additional authorization calls', async () => {
    const { canViewActivity, socket, subscriptions, testable } = setup();
    for (let index = 0; index < 100; index += 1) {
      subscriptions.add(`existing-${index}`);
    }

    await testable.subscribeToActivity(
      socket,
      USER_ID,
      JSON.stringify({ type: 'activity.subscribe', activityId: ACTIVITY_ID }),
    );

    expect(canViewActivity).not.toHaveBeenCalled();
    expect(subscriptions.size).toBe(100);
  });

  it('stops authorization calls after denied attempts exhaust the socket budget', async () => {
    const canViewActivity = vi.fn(() => Promise.resolve(undefined));
    const { socket, testable } = setup(canViewActivity);
    const message = JSON.stringify({ type: 'activity.subscribe', activityId: ACTIVITY_ID });

    for (let attempt = 0; attempt < 110; attempt += 1) {
      await testable.subscribeToActivity(socket, USER_ID, message);
    }

    expect(canViewActivity).toHaveBeenCalledTimes(100);
    expect(testable.activityAuthorizationAttempts.get(socket)).toBe(100);
  });

  it('bounds concurrent authorization calls across sockets', async () => {
    const authorization = Promise.withResolvers<void>();
    let activeAuthorizations = 0;
    let highestConcurrentAuthorizations = 0;
    const canViewActivity = vi.fn(async () => {
      activeAuthorizations += 1;
      highestConcurrentAuthorizations = Math.max(highestConcurrentAuthorizations, activeAuthorizations);
      await authorization.promise;
      activeAuthorizations -= 1;
    });
    const { testable } = setup(canViewActivity);
    const sockets = Array.from({ length: 12 }, () => {
      const socket = {} as WebSocket;
      testable.socketActivities.set(socket, new Set());
      return socket;
    });

    const subscriptions = sockets.map((socket) =>
      testable.subscribeToActivity(
        socket,
        USER_ID,
        JSON.stringify({ type: 'activity.subscribe', activityId: ACTIVITY_ID }),
      ),
    );
    await vi.waitFor(() => expect(canViewActivity).toHaveBeenCalledTimes(8));
    expect(highestConcurrentAuthorizations).toBe(8);

    authorization.resolve();
    await Promise.all(subscriptions);

    expect(canViewActivity).toHaveBeenCalledTimes(12);
    expect(highestConcurrentAuthorizations).toBe(8);
    expect(testable.activeActivityAuthorizations).toBe(0);
    expect(testable.activityAuthorizationQueue).toHaveLength(0);
  });

  it('clears pending subscription state when stopped', async () => {
    const authorization = Promise.withResolvers<{ id: string; user_id: string }>();
    const { repository, socket, subscriptions, testable } = setup(vi.fn(() => authorization.promise));
    const subscription = testable.subscribeToActivity(
      socket,
      USER_ID,
      JSON.stringify({ type: 'activity.subscribe', activityId: ACTIVITY_ID }),
    );

    await repository.stop();

    expect(testable.pendingActivitySubscriptions.size).toBe(0);
    expect(testable.socketActivities.size).toBe(0);
    expect(testable.activityAuthorizationAttempts.size).toBe(0);
    expect(testable.activityAuthorizationQueue).toHaveLength(0);
    expect(testable.activeActivityAuthorizations).toBe(0);
    authorization.resolve({ id: ACTIVITY_ID, user_id: USER_ID });
    await subscription;
    expect(subscriptions.size).toBe(0);
  });
});
