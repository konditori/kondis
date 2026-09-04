import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import {
  LiveWorkoutAckSchema,
  LiveWorkoutCreateSchema,
  LiveWorkoutListSchema,
  LiveWorkoutPointsSchema,
  LiveWorkoutSchema,
  LiveWorkoutShareSchema,
  LiveWorkoutStateSchema,
} from 'src/dtos/live-workout.dto';
import type { HonoAuthEnv } from 'src/hono/auth';
import { jsonBodyMiddleware } from 'src/hono/validation';
import type { LiveWorkoutService } from 'src/services/live-workout.service';

export type LiveWorkoutRouteService = Pick<
  LiveWorkoutService,
  'appendPoints' | 'create' | 'createShare' | 'discard' | 'get' | 'getShared' | 'list' | 'revokeShare' | 'updateState'
>;

const idParams = z.object({ id: z.string() });
const tokenParams = z.object({ token: z.string() });
const workoutResponse = LiveWorkoutSchema.openapi('LiveWorkoutDto_Output');
const workoutListResponse = LiveWorkoutListSchema.openapi('LiveWorkoutListDto_Output');
const workoutAckResponse = LiveWorkoutAckSchema.openapi('LiveWorkoutAckDto_Output');
const workoutShareResponse = LiveWorkoutShareSchema.openapi('LiveWorkoutShareDto_Output');
const createInput = LiveWorkoutCreateSchema.openapi('LiveWorkoutCreateDto');
const pointsInput = LiveWorkoutPointsSchema.openapi('LiveWorkoutPointsDto');
const stateInput = LiveWorkoutStateSchema.openapi('LiveWorkoutStateDto');

const listRoute = createRoute({
  method: 'get',
  path: '/live-workouts',
  operationId: 'LiveWorkoutController_list',
  parameters: [],
  responses: {
    200: {
      description: 'Active workouts for the signed-in user',
      content: { 'application/json': { schema: workoutListResponse } },
    },
  },
  tags: ['live workouts'],
});
const createWorkoutRoute = createRoute({
  method: 'post',
  path: '/live-workouts',
  operationId: 'LiveWorkoutController_create',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: createInput } } },
  },
  responses: {
    201: {
      description: 'Created or resumed live workout',
      content: { 'application/json': { schema: workoutResponse } },
    },
  },
  tags: ['live workouts'],
});
const sharedRoute = createRoute({
  method: 'get',
  path: '/live-workouts/shared/{token}',
  operationId: 'LiveWorkoutController_getShared',
  request: { params: tokenParams },
  responses: {
    200: {
      description: 'Live workout visible through a share link',
      content: { 'application/json': { schema: workoutResponse } },
    },
  },
  tags: ['live workouts'],
});
const getRoute = createRoute({
  method: 'get',
  path: '/live-workouts/{id}',
  operationId: 'LiveWorkoutController_get',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Live workout for its owner',
      content: { 'application/json': { schema: workoutResponse } },
    },
  },
  tags: ['live workouts'],
});
const updateRoute = createRoute({
  method: 'patch',
  path: '/live-workouts/{id}',
  operationId: 'LiveWorkoutController_update',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: stateInput } } },
  },
  responses: {
    200: {
      description: 'Updated live workout state',
      content: { 'application/json': { schema: workoutResponse } },
    },
  },
  tags: ['live workouts'],
});
const discardRoute = createRoute({
  method: 'delete',
  path: '/live-workouts/{id}',
  operationId: 'LiveWorkoutController_discard',
  request: { params: idParams },
  responses: { 204: { description: '' } },
  tags: ['live workouts'],
});
const pointsRoute = createRoute({
  method: 'post',
  path: '/live-workouts/{id}/points',
  operationId: 'LiveWorkoutController_points',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: pointsInput } } },
  },
  responses: {
    201: {
      description: 'Accepted a batch of live GPS points',
      content: { 'application/json': { schema: workoutAckResponse } },
    },
  },
  tags: ['live workouts'],
});
const shareRoute = createRoute({
  method: 'post',
  path: '/live-workouts/{id}/share',
  operationId: 'LiveWorkoutController_share',
  request: { params: idParams },
  responses: {
    201: {
      description: 'Created a revocable public live tracking token',
      content: { 'application/json': { schema: workoutShareResponse } },
    },
  },
  tags: ['live workouts'],
});
const revokeShareRoute = createRoute({
  method: 'delete',
  path: '/live-workouts/{id}/share',
  operationId: 'LiveWorkoutController_revokeShare',
  request: { params: idParams },
  responses: { 204: { description: '' } },
  tags: ['live workouts'],
});

export const registerLiveWorkoutRoutes = (app: OpenAPIHono<HonoAuthEnv>, service: LiveWorkoutRouteService): void => {
  app.openapi(listRoute, async (context) =>
    context.json(workoutListResponse.parse(await service.list(context.get('user').id)), 200),
  );
  app.openapi(createWorkoutRoute, async (context) =>
    context.json(workoutResponse.parse(await service.create(context.get('user').id, context.req.valid('json'))), 201),
  );
  app.openapi(sharedRoute, async (context) =>
    context.json(workoutResponse.parse(await service.getShared(context.req.valid('param').token)), 200),
  );
  app.openapi(getRoute, async (context) =>
    context.json(workoutResponse.parse(await service.get(context.req.valid('param').id, context.get('user').id)), 200),
  );
  app.openapi(updateRoute, async (context) =>
    context.json(
      workoutResponse.parse(
        await service.updateState(context.req.valid('param').id, context.get('user').id, context.req.valid('json')),
      ),
      200,
    ),
  );
  app.openapi(discardRoute, async (context) => {
    await service.discard(context.req.valid('param').id, context.get('user').id);
    return context.body(null, 204);
  });
  app.openapi(pointsRoute, async (context) =>
    context.json(
      workoutAckResponse.parse(
        await service.appendPoints(context.req.valid('param').id, context.get('user').id, context.req.valid('json')),
      ),
      201,
    ),
  );
  app.openapi(shareRoute, async (context) =>
    context.json(
      workoutShareResponse.parse(await service.createShare(context.req.valid('param').id, context.get('user').id)),
      201,
    ),
  );
  app.openapi(revokeShareRoute, async (context) => {
    await service.revokeShare(context.req.valid('param').id, context.get('user').id);
    return context.body(null, 204);
  });
};
