import { describe, expect, it, vi } from 'vitest';

import { DEMO_LIVE_TRACKER_NAME } from 'src/demo/live-tracker';

const mocks = vi.hoisted(() => ({
  createComposition: vi.fn(),
  getDemoUser: vi.fn(),
}));

vi.mock('src/composition.worker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/composition.worker')>()),
  createWorkerInvocationComposition: mocks.createComposition,
}));

vi.mock('src/demo/provisioner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/demo/provisioner')>()),
  getDemoUser: mocks.getDemoUser,
}));

import worker from 'src/cloudflare/entrypoint';

describe('demo live workout API boundary', () => {
  it('activates the Android simulator before serving the normal live-workout routes', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
    const namespace = {
      get: vi.fn().mockReturnValue({ fetch }),
      idFromName: vi.fn(),
    };
    const env = {
      KONDIS_DEMO_MODE: 'true',
      DEMO_LIVE_TRACKER: namespace,
    };

    const response = await worker.fetch(
      new Request('https://demo-api.internal/live-workouts'),
      env as never,
      {} as never,
    );

    // The missing Hyperdrive binding makes the normal API route unavailable in
    // this focused boundary test. The important assertion is that it no longer
    // manufactures a live-workout response from the Durable Object.
    expect(response.status).toBe(404);
    expect(namespace.idFromName).toHaveBeenCalledWith(DEMO_LIVE_TRACKER_NAME);
    expect(fetch).toHaveBeenCalledWith('https://demo-live-tracker.internal/activate', { method: 'POST' });
  });

  it('keeps Hyperdrive open until a simulated device point has been persisted', async () => {
    let persistPoint: (() => void) | undefined;
    const liveWorkoutService = {
      create: vi.fn(() =>
        new Promise((resolve) => {
          persistPoint = () => resolve({ id: '00000000-0000-4000-8000-000000000001' });
        }),
      ),
      appendPoints: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001', lastSequence: 1 }),
    };
    const close = vi.fn().mockResolvedValue(undefined);
    mocks.createComposition.mockReturnValue({
      config: { demoMode: true },
      database: {},
      liveWorkoutService,
      close,
    });
    mocks.getDemoUser.mockResolvedValue({ id: 'demo-user', email: 'john@kondis.org', role: 'admin' });

    const waitUntil = vi.fn();
    const response = worker.fetch(
      new Request('https://demo-live-ingestion.internal/api/v1/_internal/demo-live-tracker', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientSessionId: '00000000-0000-4000-8000-000000000099',
          sport: 'run',
          startedAt: '2026-09-08T14:00:00.000Z',
          elapsedSeconds: 1,
          distanceMeters: 4.7,
          points: [
            {
              sequence: 1,
              recordedAt: '2026-09-08T14:00:01.000Z',
              latitude: 59.3293,
              longitude: 18.0686,
              altitude: 28,
              accuracyMeters: 5,
            },
          ],
        }),
      }),
      { HYPERDRIVE: {}, KONDIS_DEMO_MODE: 'true' } as never,
      { waitUntil } as never,
    );

    await vi.waitFor(() => expect(liveWorkoutService.create).toHaveBeenCalledOnce());
    expect(close).not.toHaveBeenCalled();
    const acceptedResponse = await response;
    expect(acceptedResponse.status).toBe(202);
    expect(waitUntil).toHaveBeenCalledOnce();

    persistPoint?.();

    const backgroundIngestion = waitUntil.mock.calls[0]![0];
    await backgroundIngestion;
    expect(liveWorkoutService.appendPoints).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
