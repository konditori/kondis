import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import { jsonBodyMiddleware } from 'src/api/validation';
import { ACTIVITY_TAGS, ACTIVITY_TYPES } from 'src/constants';
import {
  ActivityDetailSchema,
  ActivityIdParamSchema,
  ActivityListQuerySchema,
  ActivityListResponseSchema,
  ActivitySchema,
  ActivityTagListResponseSchema,
  ActivityTypeListResponseSchema,
  ActivityUpdateSchema,
  BestEffortListParamSchema,
  BestEffortListResponseSchema,
  MatchedRouteListResponseSchema,
} from 'src/dtos/activity.dto';
import { NotFoundException } from 'src/errors';
import type { ActivityService } from 'src/services/activity.service';

export type ActivityReadService = Pick<
  ActivityService,
  'deleteById' | 'getById' | 'listBestEfforts' | 'listMatchedRoutes' | 'listRecent' | 'updateById'
>;

const activityListResponse = ActivityListResponseSchema.openapi('ActivityListResponseDto_Output');
const activityTypeListResponse = ActivityTypeListResponseSchema.openapi('ActivityTypeListResponseDto_Output');
const activityTagListResponse = ActivityTagListResponseSchema.openapi('ActivityTagListResponseDto_Output');
const bestEffortListResponse = BestEffortListResponseSchema.openapi('BestEffortListResponseDto_Output');
const activityDetailResponse = ActivityDetailSchema.openapi('ActivityDetailDto_Output');
const matchedRouteListResponse = MatchedRouteListResponseSchema.openapi('MatchedRouteListResponseDto_Output');
const activityResponse = ActivitySchema.openapi('ActivityDto_Output');
const activityUpdateInput = ActivityUpdateSchema.openapi('ActivityUpdateDto');

const listRecentRoute = createRoute({
  method: 'get',
  path: '/activities',
  operationId: 'ActivityController_listRecent',
  request: { query: ActivityListQuerySchema },
  responses: {
    200: {
      description: 'Recent activities',
      content: { 'application/json': { schema: activityListResponse } },
    },
  },
  summary: 'List recent activities',
  tags: ['activities'],
});

const listTypesRoute = createRoute({
  method: 'get',
  path: '/activities/types',
  operationId: 'ActivityController_listTypes',
  parameters: [],
  responses: {
    200: {
      description: 'Activity type settings',
      content: { 'application/json': { schema: activityTypeListResponse } },
    },
  },
  summary: 'List activity types and their behavior',
  tags: ['activities'],
});

const listTagsRoute = createRoute({
  method: 'get',
  path: '/activities/tags',
  operationId: 'ActivityController_listTags',
  parameters: [],
  responses: {
    200: {
      description: 'Activity tag settings',
      content: { 'application/json': { schema: activityTagListResponse } },
    },
  },
  summary: 'List activity tags and their applicability',
  tags: ['activities'],
});

const listBestEffortsRoute = createRoute({
  method: 'get',
  path: '/activities/best-efforts/{sport}/{type}',
  operationId: 'ActivityController_listBestEfforts',
  request: { params: BestEffortListParamSchema },
  responses: {
    200: {
      description: 'Best effort history',
      content: { 'application/json': { schema: bestEffortListResponse } },
    },
  },
  summary: 'List best efforts over time for a sport',
  tags: ['activities'],
});

const getByIdRoute = createRoute({
  method: 'get',
  path: '/activities/{id}',
  operationId: 'ActivityController_getById',
  request: { params: ActivityIdParamSchema },
  responses: {
    200: {
      description: 'Activity details',
      content: { 'application/json': { schema: activityDetailResponse } },
    },
  },
  summary: 'Get one activity and its route',
  tags: ['activities'],
});

const updateByIdRoute = createRoute({
  method: 'put',
  path: '/activities/{id}',
  operationId: 'ActivityController_updateById',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: ActivityIdParamSchema,
    body: { required: true, content: { 'application/json': { schema: activityUpdateInput } } },
  },
  responses: {
    200: {
      description: 'Updated activity',
      content: { 'application/json': { schema: activityResponse } },
    },
  },
  summary: 'Update one activity',
  tags: ['activities'],
});

const deleteByIdRoute = createRoute({
  method: 'delete',
  path: '/activities/{id}',
  operationId: 'ActivityController_deleteById',
  request: { params: ActivityIdParamSchema },
  responses: { 204: { description: '' } },
  summary: 'Delete one activity',
  tags: ['activities'],
});

const listMatchedRoutesRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/matched-routes',
  operationId: 'ActivityController_listMatchedRoutes',
  request: { params: ActivityIdParamSchema },
  responses: {
    200: {
      description: 'Matched route activities',
      content: { 'application/json': { schema: matchedRouteListResponse } },
    },
  },
  summary: 'List activities matched to the same GPS route',
  tags: ['activities'],
});

export const registerActivityReadRoutes = (app: OpenAPIHono<ApiEnv>, activities: ActivityReadService): void => {
  app.openapi(listRecentRoute, async (context) => {
    const result = await activities.listRecent(context.req.valid('query'), context.get('user').id);
    return context.json(activityListResponse.parse(result), 200);
  });
  app.openapi(listTypesRoute, (context) => context.json(activityTypeListResponse.parse([...ACTIVITY_TYPES]), 200));
  app.openapi(listTagsRoute, (context) => {
    const tags = ACTIVITY_TAGS.map((tag) => ({
      ...tag,
      sports: tag.sports === 'all' ? 'all' : [...tag.sports],
    }));
    return context.json(activityTagListResponse.parse(tags), 200);
  });
  app.openapi(listBestEffortsRoute, async (context) => {
    const { sport, type } = context.req.valid('param');
    const result = await activities.listBestEfforts(sport, type, context.get('user').id);
    return context.json(bestEffortListResponse.parse(result), 200);
  });
  app.openapi(getByIdRoute, async (context) => {
    const { id } = context.req.valid('param');
    const result = await activities.getById(id, context.get('user').id);
    if (!result) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
    return context.json(activityDetailResponse.parse(result), 200);
  });
  app.openapi(updateByIdRoute, async (context) => {
    const { id } = context.req.valid('param');
    const payload = context.req.valid('json');
    const updated = await activities.updateById(id, context.get('user').id, {
      ...payload,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
      excludeFromRankings: payload.excludeFromRankings,
      tags: payload.tags,
    });
    if (!updated) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
    return context.json(activityResponse.parse(updated), 200);
  });
  app.openapi(deleteByIdRoute, async (context) => {
    const { id } = context.req.valid('param');
    if (!(await activities.deleteById(id, context.get('user').id))) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
    return context.body(null, 204);
  });
  app.openapi(listMatchedRoutesRoute, async (context) => {
    const { id } = context.req.valid('param');
    const result = await activities.listMatchedRoutes(id, context.get('user').id);
    if (!result) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
    return context.json(matchedRouteListResponse.parse(result), 200);
  });
};
