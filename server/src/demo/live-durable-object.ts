import { aargau } from 'src/demo/demo-routes';
import { ActivityType } from 'src/enum';
import { haversineDistance } from 'src/utils/geo';

const TICK_MS = 10_000;
const STARTED_AT_KEY = 'demo-live-tracker-started-at-v2';
const POINT_INDEX_KEY = 'demo-live-tracker-point-index-v2';
const CLIENT_SESSION_ID_KEY = 'demo-live-tracker-client-session-id-v2';
const COMPLETED_KEY = 'demo-live-tracker-completed-v2';

const DISTANCE_METERS_BY_POINT: number[] = [];
for (let pointIndex = 0; pointIndex < aargau.length; pointIndex += 1) {
  const point = aargau[pointIndex]!;
  const previous = aargau[pointIndex - 1];
  DISTANCE_METERS_BY_POINT.push(
    (DISTANCE_METERS_BY_POINT[pointIndex - 1] ?? 0) +
      (previous === undefined ? 0 : haversineDistance(previous[0], previous[1], point[0], point[1])),
  );
}

export const DEMO_LIVE_TRACKER_NAME = 'demo-runner';
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
    put: (key: string, value: boolean | number | string) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
    setAlarm: (scheduledTime: number | Date) => Promise<void>;
  };
};

type DemoLiveTrackerEnv = {
  DEMO_LIVE_INGESTION?: DemoLiveIngestionBinding;
};

export class DemoLiveTracker {
  private startedAt?: number;
  private startedAtPromise?: Promise<number>;
  private pointIndex?: number;
  private pointIndexPromise?: Promise<number>;
  private clientSessionId?: string;
  private clientSessionIdPromise?: Promise<string>;
  private completed?: boolean;

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
      if (await this.isCompleted()) {
        await this.reset();
      }
      await this.ingest();
      return new Response(null, { status: 204 });
    } finally {
      if (!(await this.isCompleted())) {
        await this.scheduleNextTick();
      }
    }
  }

  async alarm(): Promise<void> {
    try {
      if (await this.isCompleted()) {
        await this.reset();
      }
      await this.ingest();
    } catch (error) {
      console.error('Demo live tracker ingestion failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Keep the simulated device alive through transient API failures. Durable
      // Object alarms only retry a finite number of uncaught failures.
      if (!(await this.isCompleted())) {
        await this.scheduleNextTick();
      }
    }
  }

  private async ingest(): Promise<void> {
    if (!this.env.DEMO_LIVE_INGESTION) {
      throw new Error('DEMO_LIVE_INGESTION is required for the demo live tracker');
    }
    const startedAt = await this.getStartedAt();
    const pointIndex = await this.getPointIndex();
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    const distanceMeters = DISTANCE_METERS_BY_POINT[pointIndex]!;
    const finished = pointIndex === aargau.length - 1;
    const clientSessionId = await this.getClientSessionId();
    const points = aargau.slice(0, pointIndex + 1).map(([pointLatitude, pointLongitude, pointAltitude], index) => ({
      sequence: index + 1,
      recordedAt: new Date(index === pointIndex ? now : startedAt + index * TICK_MS).toISOString(),
      latitude: pointLatitude,
      longitude: pointLongitude,
      altitude: pointAltitude,
      accuracyMeters: 5,
    }));
    const response = await this.env.DEMO_LIVE_INGESTION.fetch(
      new Request(`https://${DEMO_LIVE_INGESTION_HOST}${DEMO_LIVE_INGESTION_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientSessionId,
          sport: ActivityType.Ride,
          startedAt: new Date(startedAt).toISOString(),
          elapsedSeconds,
          distanceMeters,
          finished,
          points,
        }),
      }),
    );
    if (!response.ok) {
      throw new Error(`Demo live ingestion returned HTTP ${response.status}`);
    }
    if (finished) {
      // The finished workout has been persisted by the ingestion service. Reset
      // the simulator state so the next alarm starts a fresh virtual workout,
      // including a new client session id.
      await this.reset();
    } else {
      await this.state.storage.put(POINT_INDEX_KEY, pointIndex + 1);
      this.pointIndex = pointIndex + 1;
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

  private async getPointIndex(): Promise<number> {
    if (this.pointIndex !== undefined) {
      return this.pointIndex;
    }
    this.pointIndexPromise ??= (async () => {
      const stored = await this.state.storage.get<number>(POINT_INDEX_KEY);
      const pointIndex = stored ?? 0;
      if (stored === undefined) {
        await this.state.storage.put(POINT_INDEX_KEY, pointIndex);
      }
      this.pointIndex = pointIndex;
      return pointIndex;
    })();
    return this.pointIndexPromise;
  }

  private async getClientSessionId(): Promise<string> {
    if (this.clientSessionId !== undefined) {
      return this.clientSessionId;
    }
    this.clientSessionIdPromise ??= (async () => {
      const stored = await this.state.storage.get<string>(CLIENT_SESSION_ID_KEY);
      const clientSessionId = stored ?? crypto.randomUUID();
      if (stored === undefined) {
        await this.state.storage.put(CLIENT_SESSION_ID_KEY, clientSessionId);
      }
      this.clientSessionId = clientSessionId;
      return clientSessionId;
    })();
    return this.clientSessionIdPromise;
  }

  private async isCompleted(): Promise<boolean> {
    if (this.completed !== undefined) {
      return this.completed;
    }
    this.completed = (await this.state.storage.get<boolean>(COMPLETED_KEY)) ?? false;
    return this.completed;
  }

  private async reset(): Promise<void> {
    await Promise.all([
      this.state.storage.delete(STARTED_AT_KEY),
      this.state.storage.delete(POINT_INDEX_KEY),
      this.state.storage.delete(CLIENT_SESSION_ID_KEY),
      this.state.storage.delete(COMPLETED_KEY),
    ]);
    this.startedAt = undefined;
    this.startedAtPromise = undefined;
    this.pointIndex = undefined;
    this.pointIndexPromise = undefined;
    this.clientSessionId = undefined;
    this.clientSessionIdPromise = undefined;
    this.completed = false;
  }

  private async scheduleNextTick(): Promise<void> {
    const startedAt = await this.getStartedAt();
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / TICK_MS));
    const nextTickAt = startedAt + (elapsedSeconds + 1) * TICK_MS;
    await this.state.storage.setAlarm(Math.max(nextTickAt, now + 1));
  }
}
