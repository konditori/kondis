import { z } from '@hono/zod-openapi';
import type { AuthenticatedUser } from 'src/auth';
import type { createWorkerInvocationComposition } from 'src/composition.worker';
import {
  DEMO_LIVE_INGESTION_HOST,
  DEMO_LIVE_INGESTION_PATH,
  DEMO_LIVE_TRACKER_NAME,
  type DemoLiveTrackerNamespaceBinding,
} from 'src/demo/live-durable-object';
import { LivePointSchema, LiveWorkoutCreateSchema, LiveWorkoutPointsSchema } from 'src/dtos/live-workout.dto';
import { aargau } from 'src/demo/demo-routes';

const DemoLiveWorkoutPointsSchema = LiveWorkoutPointsSchema.safeExtend({
  // The simulator may need to repair a workout after its PostgreSQL row was
  // recreated while the Durable Object retained its route position.
  points: z.array(LivePointSchema).min(1).max(aargau.length),
  finished: z.boolean().optional(),
});

type DemoLiveEnvironment = {
  KONDIS_DEMO_MODE?: boolean | string;
  DEMO_LIVE_TRACKER?: DemoLiveTrackerNamespaceBinding;
};

export const isDemoLiveWorkoutRequest = (request: Request, env: DemoLiveEnvironment): boolean => {
  if (!isEnabled(env.KONDIS_DEMO_MODE) || request.method !== 'GET') {
    return false;
  }
  const path = new URL(request.url).pathname;
  const apiPath = path.startsWith('/api/v1/') ? path.slice('/api/v1'.length) : path;
  return apiPath === '/live-workouts' || /^\/live-workouts\/[^/]+$/.test(apiPath);
};

export const activateDemoLiveTracker = async (env: DemoLiveEnvironment): Promise<Response | undefined> => {
  if (!env.DEMO_LIVE_TRACKER) {
    return Response.json({ statusCode: 503, message: 'Demo live tracker unavailable' }, { status: 503 });
  }
  try {
    const tracker = env.DEMO_LIVE_TRACKER.get(env.DEMO_LIVE_TRACKER.idFromName(DEMO_LIVE_TRACKER_NAME));
    const response = await tracker.fetch('https://demo-live-tracker.internal/activate', { method: 'POST' });
    if (!response.ok) {
      console.error('Demo live tracker activation failed', { status: response.status });
      return Response.json({ statusCode: 502, message: 'Demo live tracker unavailable' }, { status: 502 });
    }
  } catch (error) {
    console.error('Demo live tracker activation failed', error);
    return Response.json({ statusCode: 502, message: 'Demo live tracker unavailable' }, { status: 502 });
  }
};

export const isDemoLiveTrackerIngestionRequest = (request: Request, env: DemoLiveEnvironment): boolean => {
  const url = new URL(request.url);
  return (
    isEnabled(env.KONDIS_DEMO_MODE) &&
    request.method === 'POST' &&
    url.hostname === DEMO_LIVE_INGESTION_HOST &&
    url.pathname === DEMO_LIVE_INGESTION_PATH
  );
};

export const ingestDemoLiveTrackerPoint = async (
  request: Request,
  composition: ReturnType<typeof createWorkerInvocationComposition>,
  demoUser: AuthenticatedUser | undefined,
): Promise<Response> => {
  if (!demoUser) {
    return Response.json({ statusCode: 404, message: 'Not Found' }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ statusCode: 400, message: 'Bad Request' }, { status: 400 });
  }
  const session = LiveWorkoutCreateSchema.safeParse(body);
  const points = DemoLiveWorkoutPointsSchema.safeParse(body);
  if (!session.success || !points.success) {
    return Response.json({ statusCode: 400, message: 'Bad Request' }, { status: 400 });
  }
  const workout = await composition.liveWorkoutService.create(demoUser.id, session.data);
  const acknowledgement = await composition.liveWorkoutService.appendPoints(workout.id, demoUser.id, points.data);
  if (points.data.finished) {
    await composition.liveWorkoutService.updateState(workout.id, demoUser.id, {
      status: 'ended',
      elapsedSeconds: points.data.elapsedSeconds,
      distanceMeters: points.data.distanceMeters,
    });
  }
  return Response.json(acknowledgement, { status: 201 });
};

const isEnabled = (value: boolean | string | undefined): boolean => value === true || value === 'true';
