import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEMO_LIVE_INGESTION_HOST, DEMO_LIVE_INGESTION_PATH, DemoLiveTracker } from 'src/demo/live-durable-object';
import { aargau } from 'src/demo/demo-routes';

describe(DemoLiveTracker.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('simulates an Android device by ingesting one GPS point and scheduling the next tick', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const fetch = vi.fn((_request: Request | string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    const state = {
      storage: {
        get: vi
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    };
    const tracker = new DemoLiveTracker(state as never, { DEMO_LIVE_INGESTION: { fetch } });

    const response = await tracker.fetch(
      new Request('https://demo-live-tracker.internal/activate', { method: 'POST' }),
    );

    expect(response.status).toBe(204);
    expect(state.storage.put).toHaveBeenCalledTimes(4);
    const request = fetch.mock.calls[0]![0] as unknown as Request;
    expect(request.url).toBe(`https://${DEMO_LIVE_INGESTION_HOST}${DEMO_LIVE_INGESTION_PATH}`);
    expect(request.method).toBe('POST');
    const payload = await request.json();
    expect(Date.parse(payload.startedAt as string)).toBe(Date.now());
    expect(payload).toMatchObject({
      clientSessionId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      sport: 'ride',
      elapsedSeconds: 0,
      distanceMeters: 0,
      points: [
        expect.objectContaining({
          sequence: expect.any(Number),
          latitude: expect.any(Number),
          longitude: expect.any(Number),
          altitude: expect.any(Number),
          accuracyMeters: 5,
        }),
      ],
    });
    expect((payload.points as [{ sequence: number }])[0].sequence).toBe(1);
    expect(state.storage.setAlarm).toHaveBeenCalledWith(Date.now() + 10_000);
  });

  it('keeps uploading the next point after each alarm', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-09-08T12:00:00.000Z');
    vi.setSystemTime(startedAt);
    const fetch = vi.fn((_request: Request | string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    const state = {
      storage: {
        get: vi
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(startedAt.getTime())
          .mockResolvedValueOnce(100)
          .mockResolvedValueOnce('00000000-0000-4000-8000-000000000099'),
        put: vi.fn(),
        delete: vi.fn().mockResolvedValue(true),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    };
    const tracker = new DemoLiveTracker(state as never, { DEMO_LIVE_INGESTION: { fetch } });

    await tracker.fetch(new Request('https://demo-live-tracker.internal/activate', { method: 'POST' }));
    vi.setSystemTime(new Date(startedAt.getTime() + 10_000));
    await tracker.alarm();

    expect(fetch).toHaveBeenCalledTimes(2);
    const firstRequest = fetch.mock.calls[0]![0] as unknown as Request;
    const request = fetch.mock.calls[1]![0] as unknown as Request;
    const firstPayload = await firstRequest.json();
    const secondPayload = await request.json();
    expect(secondPayload.clientSessionId).toBe(firstPayload.clientSessionId);
    expect(secondPayload).toMatchObject({
      elapsedSeconds: 10,
      distanceMeters: expect.any(Number),
    });
    expect((secondPayload.points as { sequence: number }[]).at(-1)?.sequence).toBe(102);
    expect(secondPayload.distanceMeters).toBeGreaterThan(firstPayload.distanceMeters);
    expect(state.storage.setAlarm).toHaveBeenCalledTimes(2);
  });

  it('schedules from the simulated clock instead of adding latency to each interval', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-09-08T12:00:00.000Z');
    vi.setSystemTime(startedAt);
    const fetch = vi.fn(() => {
      vi.setSystemTime(new Date(startedAt.getTime() + 695));
      return Promise.resolve(new Response(null, { status: 201 }));
    });
    const state = {
      storage: {
        get: vi
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(startedAt.getTime())
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce('00000000-0000-4000-8000-000000000099'),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    };
    const tracker = new DemoLiveTracker(state as never, { DEMO_LIVE_INGESTION: { fetch } });

    await tracker.fetch(new Request('https://demo-live-tracker.internal/activate', { method: 'POST' }));

    expect(state.storage.setAlarm).toHaveBeenCalledWith(startedAt.getTime() + 10_000);
  });

  it('resets the simulator after the final point and schedules a new run', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-09-08T12:00:00.000Z');
    vi.setSystemTime(startedAt);
    const fetch = vi.fn((_request: Request | string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    const state = {
      storage: {
        get: vi
          .fn()
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(startedAt.getTime())
          .mockResolvedValueOnce(aargau.length - 1)
          .mockResolvedValueOnce('00000000-0000-4000-8000-000000000099'),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    };
    const tracker = new DemoLiveTracker(state as never, { DEMO_LIVE_INGESTION: { fetch } });

    await tracker.alarm();

    expect(fetch).toHaveBeenCalledOnce();
    const finishedPayload = await (fetch.mock.calls[0]![0] as Request).clone().json();
    expect(finishedPayload).toMatchObject({
      finished: true,
    });
    expect((finishedPayload.points as { sequence: number }[]).at(-1)?.sequence).toBe(aargau.length);
    expect(state.storage.delete).toHaveBeenCalledWith('demo-live-tracker-started-at-v2');
    expect(state.storage.delete).toHaveBeenCalledWith('demo-live-tracker-point-index-v2');
    expect(state.storage.delete).toHaveBeenCalledWith('demo-live-tracker-client-session-id-v2');
    expect(state.storage.delete).toHaveBeenCalledWith('demo-live-tracker-completed-v2');
    expect(state.storage.setAlarm).toHaveBeenCalledWith(Date.now() + 10_000);

    vi.setSystemTime(new Date(startedAt.getTime() + 10_000));
    await tracker.alarm();

    expect(fetch).toHaveBeenCalledTimes(2);
    const restartedPayload = await (fetch.mock.calls[1]![0] as Request).clone().json();
    expect(restartedPayload).toMatchObject({ finished: false, points: [{ sequence: 1 }] });
    expect(restartedPayload.clientSessionId).not.toBe('00000000-0000-4000-8000-000000000099');
  });

  it('recovers a durable object that was reconstructed with completed state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const fetch = vi.fn((_request: Request | string, _init?: RequestInit) =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    const state = {
      storage: {
        get: vi
          .fn()
          .mockResolvedValueOnce(true)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined)
          .mockResolvedValueOnce(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
        setAlarm: vi.fn().mockResolvedValue(undefined),
      },
    };
    const tracker = new DemoLiveTracker(state as never, { DEMO_LIVE_INGESTION: { fetch } });

    await tracker.fetch(new Request('https://demo-live-tracker.internal/activate', { method: 'POST' }));

    expect(fetch).toHaveBeenCalledOnce();
    const payload = await (fetch.mock.calls[0]![0] as Request).clone().json();
    expect(payload).toMatchObject({ finished: false, points: [{ sequence: 1 }] });
    expect(state.storage.delete).toHaveBeenCalledTimes(4);
  });
});
