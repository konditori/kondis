const METERS_PER_SECOND = 4.7;
const TICK_MS = 10_000;
const STARTED_AT_KEY = 'demo-live-tracker-started-at';

// A small predetermined loop keeps the demo deterministic while still making
// the simulated Android device follow a believable route. Coordinates are
// [longitude, latitude].
const TRAIL_ROUTE: [number, number][] = [
  [18.0686, 59.3293],
  [18.0702, 59.3301],
  [18.0721, 59.3304],
  [18.0739, 59.3296],
  [18.0745, 59.3278],
  [18.0734, 59.3261],
  [18.0712, 59.3252],
  [18.069, 59.3258],
  [18.0673, 59.3272],
  [18.0665, 59.329],
  [18.0678, 59.331],
  [18.07, 59.3323],
  [18.0727, 59.3325],
  [18.075, 59.3314],
  [18.0761, 59.3295],
  [18.0753, 59.3273],
  [18.0736, 59.3255],
  [18.071, 59.3242],
  [18.0681, 59.3248],
  [18.0648, 59.3294],
  [18.066, 59.3318],
  [18.0688, 59.3332],
  [18.0719, 59.3337],
  [18.0748, 59.333],
  [18.0772, 59.3313],
  [18.078, 59.329],
  [18.0771, 59.3268],
  [18.075, 59.3247],
  [18.0723, 59.3234],
  [18.069, 59.3238],
  [18.0662, 59.3254],
  [18.064, 59.328],
  [18.0645, 59.3307],
  [18.0665, 59.333],
  [18.0695, 59.3345],
  [18.0686, 59.3293],
];

const metersBetween = (from: [number, number], to: [number, number]): number => {
  const latitudeRadians = ((from[1] + to[1]) / 2) * (Math.PI / 180);
  const longitudeMeters = (to[0] - from[0]) * 111_320 * Math.cos(latitudeRadians);
  const latitudeMeters = (to[1] - from[1]) * 110_574;
  return Math.hypot(longitudeMeters, latitudeMeters);
};

const TRAIL_SEGMENTS = (() => {
  let startDistance = 0;
  return TRAIL_ROUTE.slice(1).map((point, index) => {
    const start = TRAIL_ROUTE[index]!;
    const length = metersBetween(start, point);
    const segment = { point, start, startDistance, length };
    startDistance += length;
    return segment;
  });
})();
const TRAIL_LENGTH_METERS = TRAIL_SEGMENTS.at(-1)!.startDistance + TRAIL_SEGMENTS.at(-1)!.length;

const pointAtDistance = (distance: number): [number, number] => {
  const normalizedDistance = ((distance % TRAIL_LENGTH_METERS) + TRAIL_LENGTH_METERS) % TRAIL_LENGTH_METERS;
  const segment =
    TRAIL_SEGMENTS.find(({ startDistance, length }) => normalizedDistance <= startDistance + length) ??
    TRAIL_SEGMENTS.at(-1)!;
  const progress = Math.min(1, Math.max(0, (normalizedDistance - segment.startDistance) / segment.length));
  return [
    segment.start[0] + (segment.point[0] - segment.start[0]) * progress,
    segment.start[1] + (segment.point[1] - segment.start[1]) * progress,
  ];
};

export const DEMO_LIVE_TRACKER_NAME = 'demo-runner';
export const DEMO_LIVE_TRACKER_CLIENT_SESSION_ID = '00000000-0000-4000-8000-000000000099';
export const DEMO_LIVE_INGESTION_HOST = 'demo-live-ingestion.internal';
export const DEMO_LIVE_INGESTION_PATH = '/api/v1/_internal/demo-live-tracker';

export type DemoLiveTrackerNamespaceBinding = {
  idFromName: (name: string) => unknown;
  get: (id: unknown) => {
    fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
  };
};

export type DemoLiveIngestionBinding = {
  fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
};

type DemoLiveTrackerState = {
  storage: {
    get: <T>(key: string) => Promise<T | undefined>;
    put: (key: string, value: number) => Promise<void>;
    setAlarm: (scheduledTime: number | Date) => Promise<void>;
  };
};

type DemoLiveTrackerEnv = {
  DEMO_LIVE_INGESTION?: DemoLiveIngestionBinding;
};

export class DemoLiveTracker {
  private startedAt?: number;
  private startedAtPromise?: Promise<number>;

  constructor(
    private readonly state: DemoLiveTrackerState,
    private readonly env: DemoLiveTrackerEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/activate' || request.method !== 'POST') {
      return new Response('Not Found', { status: 404 });
    }
    try {
      await this.ingest();
      return new Response(null, { status: 204 });
    } finally {
      await this.scheduleNextTick();
    }
  }

  async alarm(): Promise<void> {
    try {
      await this.ingest();
    } catch (error) {
      console.error('Demo live tracker ingestion failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Keep the simulated device alive through transient API failures. Durable
      // Object alarms only retry a finite number of uncaught failures.
      await this.scheduleNextTick();
    }
  }

  private async ingest(): Promise<void> {
    if (!this.env.DEMO_LIVE_INGESTION) {
      throw new Error('DEMO_LIVE_INGESTION is required for the demo live tracker');
    }
    const startedAt = await this.getStartedAt();
    const now = Date.now();
    const elapsedMilliseconds = Math.max(0, now - startedAt);
    const elapsedSeconds = Math.floor(elapsedMilliseconds / 1000);
    const sequence = Math.floor(elapsedMilliseconds / TICK_MS) + 1;
    const distanceMeters = elapsedSeconds * METERS_PER_SECOND;
    const [longitude, latitude] = pointAtDistance(distanceMeters);
    const response = await this.env.DEMO_LIVE_INGESTION.fetch(
      new Request(`https://${DEMO_LIVE_INGESTION_HOST}${DEMO_LIVE_INGESTION_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientSessionId: DEMO_LIVE_TRACKER_CLIENT_SESSION_ID,
          sport: 'run',
          startedAt: new Date(startedAt).toISOString(),
          elapsedSeconds,
          distanceMeters,
          points: [
            {
              sequence,
              recordedAt: new Date(startedAt + elapsedMilliseconds).toISOString(),
              latitude,
              longitude,
              altitude: 28,
              accuracyMeters: 5,
            },
          ],
        }),
      }),
    );
    if (!response.ok) {
      throw new Error(`Demo live ingestion returned HTTP ${response.status}`);
    }
  }

  private async getStartedAt(): Promise<number> {
    if (this.startedAt !== undefined) {
      return this.startedAt;
    }
    this.startedAtPromise ??= (async () => {
      const stored = await this.state.storage.get<number>(STARTED_AT_KEY);
      const startedAt = stored ?? Date.now();
      if (stored === undefined) {
        await this.state.storage.put(STARTED_AT_KEY, startedAt);
      }
      this.startedAt = startedAt;
      return startedAt;
    })();
    return this.startedAtPromise;
  }

  private async scheduleNextTick(): Promise<void> {
    const startedAt = await this.getStartedAt();
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / TICK_MS));
    const nextTickAt = startedAt + (elapsedSeconds + 1) * TICK_MS;
    // Schedule against the simulated device clock so API/DB latency does not
    // accumulate into a slower-than-configured track. If the request overran
    // the target, wake as soon as the platform permits and let the next sample
    // catch up from elapsed time.
    await this.state.storage.setAlarm(Math.max(nextTickAt, now + 1));
  }
}
