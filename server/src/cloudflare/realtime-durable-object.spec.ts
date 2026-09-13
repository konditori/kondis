import { describe, expect, it, vi } from 'vitest';

import { DurableObjectRealtimeAdapter, RealtimeDurableObject } from 'src/cloudflare/realtime-durable-object';

const attachment = (kind: 'user' | 'admin', sessionId = 'session-id') => ({
  kind,
  sessionId,
  userId: kind === 'user' ? 'user-id' : null,
  sessionExpiresAt: Date.now() + 60_000,
  activityIds: [],
  authorizationAttempts: 0,
});

const socket = (value: ReturnType<typeof attachment>) => {
  let current = value;
  return {
    close: vi.fn(),
    deserializeAttachment: () => current,
    send: vi.fn(),
    serializeAttachment: (next: typeof current) => {
      current = next;
    },
  } as unknown as WebSocket & { deserializeAttachment: () => typeof current };
};

describe('DurableObjectRealtimeAdapter', () => {
  it('publishes events through the namespace', async () => {
    let published: Request | undefined;
    const fetch = vi.fn((request: Request | string, init?: RequestInit) => {
      published = request instanceof Request ? request : new Request(request, init);
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    const namespace = {
      idFromName: vi.fn(() => 'global-id'),
      get: vi.fn(() => ({ fetch })),
    };
    const adapter = new DurableObjectRealtimeAdapter(namespace);

    await adapter.emit('JobUpdated');

    expect(namespace.idFromName).toHaveBeenCalledWith('global');
    expect(fetch).toHaveBeenCalledOnce();
    await expect(published?.json()).resolves.toEqual({ type: 'job.updated' });
  });

  it('swallows delivery failures so database mutations remain successful', async () => {
    const namespace = {
      idFromName: () => 'global-id',
      get: () => ({ fetch: vi.fn(() => Promise.reject(new Error('unavailable'))) }),
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(new DurableObjectRealtimeAdapter(namespace).emit('JobUpdated')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe(RealtimeDurableObject.name, () => {
  it('accepts authenticated WebSocket upgrades through the Durable Object', async () => {
    const serverSocket = socket(attachment('user'));
    const clientSocket = {} as WebSocket;
    const state = {
      acceptWebSocket: vi.fn(),
      getWebSockets: () => [],
      storage: { setAlarm: vi.fn() },
    };
    vi.stubGlobal(
      'WebSocketPair',
      class {
        0 = clientSocket;
        1 = serverSocket;
      },
    );
    vi.stubGlobal(
      'Response',
      class {
        status: number;

        constructor(_body: unknown, init?: { status?: number }) {
          this.status = init?.status ?? 200;
        }
      },
    );

    const response = await new RealtimeDurableObject(state as never, {}).fetch(
      new Request(
        'https://realtime.internal/connect?scope=activity-events&sessionId=session-id&userId=user-id&sessionExpiresAt=4102444800000',
        { headers: { Upgrade: 'websocket' } },
      ),
    );

    expect(response.status).toBe(101);
    expect(state.acceptWebSocket).toHaveBeenCalledWith(serverSocket);
    expect(serverSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'connected' }));
    vi.unstubAllGlobals();
  });

  it('routes job events only to admin sockets and rejects malformed publications', async () => {
    const admin = socket(attachment('admin'));
    const user = socket(attachment('user'));
    const state = {
      acceptWebSocket: vi.fn(),
      getWebSockets: () => [admin, user],
      storage: { setAlarm: vi.fn() },
    };
    const hub = new RealtimeDurableObject(state as never, {});

    await expect(
      hub.fetch(
        new Request('https://realtime.internal/publish', {
          method: 'POST',
          body: JSON.stringify({ type: 'job.updated' }),
        }),
      ),
    ).resolves.toMatchObject({ status: 204 });
    expect(admin.send).toHaveBeenCalledWith(JSON.stringify({ type: 'job.updated' }));
    expect(user.send).not.toHaveBeenCalled();

    await expect(
      hub.fetch(new Request('https://realtime.internal/publish', { method: 'POST', body: '{}' })),
    ).resolves.toMatchObject({ status: 400 });
  });

  it('routes live workout updates only to the workout owner', async () => {
    const owner = socket(attachment('user'));
    const otherUser = socket({ ...attachment('user'), userId: 'other-user-id' });
    const state = {
      acceptWebSocket: vi.fn(),
      getWebSockets: () => [owner, otherUser],
      storage: { setAlarm: vi.fn() },
    };
    const hub = new RealtimeDurableObject(state as never, {});
    const event = {
      type: 'live-workout.updated',
      userId: 'user-id',
      workout: {
        id: 'workout-id',
        status: 'recording',
        elapsedSeconds: 1,
        distanceMeters: 4.7,
        lastSequence: 1,
        recordedAt: '2026-09-08T12:00:01.000Z',
        position: [18.07, 59.33],
      },
    };

    await expect(
      hub.fetch(
        new Request('https://realtime.internal/publish', {
          method: 'POST',
          body: JSON.stringify(event),
        }),
      ),
    ).resolves.toMatchObject({ status: 204 });

    expect(owner.send).toHaveBeenCalledWith(JSON.stringify(event));
    expect(otherUser.send).not.toHaveBeenCalled();
  });
});
