import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';
import { NotFoundException } from '@nestjs/common';

import { ACTIVITY_TAGS, ACTIVITY_TYPES } from 'src/constants';
import {
  ActivityDetailSchema,
  ActivityIdParamSchema,
  ActivityListQuerySchema,
  ActivityListResponseSchema,
  ActivityTagListResponseSchema,
  ActivityTypeListResponseSchema,
  BestEffortListParamSchema,
  BestEffortListResponseSchema,
  MatchedRouteListResponseSchema,
} from 'src/dtos/activity.dto';
import type { HonoAuthEnv } from 'src/hono/auth';
import type { ActivityService } from 'src/services/activity.service';

export type ActivityReadService = Pick<
  ActivityService,
  'getById' | 'listBestEfforts' | 'listMatchedRoutes' | 'listRecent'
>;

const activityListResponse = ActivityListResponseSchema.openapi('ActivityListResponseDto_Output');
const activityTypeListResponse = ActivityTypeListResponseSchema.openapi('ActivityTypeListResponseDto_Output');
const activityTagListResponse = ActivityTagListResponseSchema.openapi('ActivityTagListResponseDto_Output');
const bestEffortListResponse = BestEffortListResponseSchema.openapi('BestEffortListResponseDto_Output');
const activityDetailResponse = ActivityDetailSchema.openapi('ActivityDetailDto_Output');
const matchedRouteListResponse = MatchedRouteListResponseSchema.openapi('MatchedRouteListResponseDto_Output');

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

export const registerActivityReadRoutes = (app: OpenAPIHono<HonoAuthEnv>, activities: ActivityReadService): void => {
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
  app.openapi(listMatchedRoutesRoute, async (context) => {
    const { id } = context.req.valid('param');
    const result = await activities.listMatchedRoutes(id, context.get('user').id);
    if (!result) {
      throw new NotFoundException(`Activity ${id} does not exist`);
    }
    return context.json(matchedRouteListResponse.parse(result), 200);
  });
};
