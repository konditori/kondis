import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import { jsonBodyMiddleware } from 'src/api/validation';
import {
  LiveActivityAckSchema,
  LiveActivityCreateSchema,
  LiveActivityListSchema,
  LiveActivityPointsSchema,
  LiveActivitySchema,
  LiveActivityShareSchema,
  LiveActivityStateSchema,
} from 'src/dtos/live-activity.dto';
import type { LiveService } from 'src/services/live-activity.service';

export type LiveActivityRouteService = Pick<
  LiveService,
  'appendPoints' | 'create' | 'createShare' | 'discard' | 'get' | 'getShared' | 'list' | 'revokeShare' | 'updateState'
>;

const idParams = z.object({ id: z.string() });
const tokenParams = z.object({ token: z.string() });
const activityResponse = LiveActivitySchema.openapi('LiveActivityDto_Output');
const activityListResponse = LiveActivityListSchema.openapi('LiveActivityListDto_Output');
const activityAckResponse = LiveActivityAckSchema.openapi('LiveActivityAckDto_Output');
const activityShareResponse = LiveActivityShareSchema.openapi('LiveActivityShareDto_Output');
const createInput = LiveActivityCreateSchema.openapi('LiveActivityCreateDto');
const pointsInput = LiveActivityPointsSchema.openapi('LiveActivityPointsDto');
const stateInput = LiveActivityStateSchema.openapi('LiveActivityStateDto');

const listRoute = createRoute({
  method: 'get',
  path: '/live-activities',
  operationId: 'LiveActivityController_list',
  parameters: [],
  responses: {
    200: {
      description: 'Active activities for the signed-in user',
      content: { 'application/json': { schema: activityListResponse } },
    },
  },
  tags: ['live activities'],
});
const createActivityRoute = createRoute({
  method: 'post',
  path: '/live-activities',
  operationId: 'LiveActivityController_create',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  request: {
    body: { required: true, content: { 'application/json': { schema: createInput } } },
  },
  responses: {
    201: {
      description: 'Created or resumed live activity',
      content: { 'application/json': { schema: activityResponse } },
    },
  },
  tags: ['live activities'],
});
const sharedRoute = createRoute({
  method: 'get',
  path: '/live-activities/shared/{token}',
  operationId: 'LiveActivityController_getShared',
  request: { params: tokenParams },
  responses: {
    200: {
      description: 'Live activity visible through a share link',
      content: { 'application/json': { schema: activityResponse } },
    },
  },
  tags: ['live activities'],
});
const getRoute = createRoute({
  method: 'get',
  path: '/live-activities/{id}',
  operationId: 'LiveActivityController_get',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Live activity for its owner',
      content: { 'application/json': { schema: activityResponse } },
    },
  },
  tags: ['live activities'],
});
const updateRoute = createRoute({
  method: 'patch',
  path: '/live-activities/{id}',
  operationId: 'LiveActivityController_update',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: stateInput } } },
  },
  responses: {
    200: {
      description: 'Updated live activity state',
      content: { 'application/json': { schema: activityResponse } },
    },
  },
  tags: ['live activities'],
});
const discardRoute = createRoute({
  method: 'delete',
  path: '/live-activities/{id}',
  operationId: 'LiveActivityController_discard',
  request: { params: idParams },
  responses: { 204: { description: '' } },
  tags: ['live activities'],
});
const pointsRoute = createRoute({
  method: 'post',
  path: '/live-activities/{id}/points',
  operationId: 'LiveActivityController_points',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: pointsInput } } },
  },
  responses: {
    201: {
      description: 'Accepted a batch of live GPS points',
      content: { 'application/json': { schema: activityAckResponse } },
    },
  },
  tags: ['live activities'],
});
const shareRoute = createRoute({
  method: 'post',
  path: '/live-activities/{id}/share',
  operationId: 'LiveActivityController_share',
  request: { params: idParams },
  responses: {
    201: {
      description: 'Created a revocable public live tracking token',
      content: { 'application/json': { schema: activityShareResponse } },
    },
  },
  tags: ['live activities'],
});
const revokeShareRoute = createRoute({
  method: 'delete',
  path: '/live-activities/{id}/share',
  operationId: 'LiveActivityController_revokeShare',
  request: { params: idParams },
  responses: { 204: { description: '' } },
  tags: ['live activities'],
});

export const registerLiveActivityReadRoutes = (
  app: OpenAPIHono<ApiEnv>,
  service: Pick<LiveActivityRouteService, 'get' | 'getShared' | 'list'>,
): void => {
  app.openapi(listRoute, async (context) =>
    context.json(activityListResponse.parse(await service.list(context.get('user').id)), 200),
  );
  app.openapi(sharedRoute, async (context) =>
    context.json(activityResponse.parse(await service.getShared(context.req.valid('param').token)), 200),
  );
  app.openapi(getRoute, async (context) =>
    context.json(activityResponse.parse(await service.get(context.req.valid('param').id, context.get('user').id)), 200),
  );
};

export const registerLiveActivityRoutes = (app: OpenAPIHono<ApiEnv>, service: LiveActivityRouteService): void => {
  registerLiveActivityReadRoutes(app, service);
  app.openapi(createActivityRoute, async (context) =>
    context.json(activityResponse.parse(await service.create(context.get('user').id, context.req.valid('json'))), 201),
  );
  app.openapi(updateRoute, async (context) =>
    context.json(
      activityResponse.parse(
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
      activityAckResponse.parse(
        await service.appendPoints(context.req.valid('param').id, context.get('user').id, context.req.valid('json')),
      ),
      201,
    ),
  );
  app.openapi(shareRoute, async (context) =>
    context.json(
      activityShareResponse.parse(await service.createShare(context.req.valid('param').id, context.get('user').id)),
      201,
    ),
  );
  app.openapi(revokeShareRoute, async (context) => {
    await service.revokeShare(context.req.valid('param').id, context.get('user').id);
    return context.body(null, 204);
  });
};
