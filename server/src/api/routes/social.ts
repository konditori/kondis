import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import { ActivityListQuerySchema, ActivityListResponseSchema } from 'src/dtos/activity.dto';
import {
  CommentListSchema,
  LikerListSchema,
  NotificationListSchema,
  PeopleListSchema,
  PersonSchema,
  RequestDirectionQuerySchema,
  RequestListSchema,
} from 'src/dtos/social.dto';
import type { ActivityService } from 'src/services/activity.service';
import type { SocialService } from 'src/services/social.service';

export type SocialReadService = Pick<
  SocialService,
  'comments' | 'likers' | 'notifications' | 'people' | 'person' | 'requests'
>;
export type SocialActivityReadService = Pick<ActivityService, 'feed' | 'profileActivities'>;

const idParams = z.object({ id: z.string() });
const peopleQuery = z.object({ query: z.string().optional() });
const limitQuery = z.coerce.number().int().min(1).max(50).optional();
const notificationsQuery = z.object({ limit: limitQuery });
const commentsQuery = z.object({ cursor: z.string().optional(), limit: limitQuery });
const peopleListResponse = PeopleListSchema.openapi('PeopleListDto_Output');
const personResponse = PersonSchema.openapi('PersonDto_Output');
const activityListResponse = ActivityListResponseSchema.openapi('ActivityListResponseDto_Output');
const requestListResponse = RequestListSchema.openapi('RequestListDto_Output');
const likerListResponse = LikerListSchema.openapi('LikerListDto_Output');
const notificationListResponse = NotificationListSchema.openapi('NotificationListDto_Output');
const commentListResponse = CommentListSchema.openapi('CommentListDto_Output');

const peopleRoute = createRoute({
  method: 'get',
  path: '/people',
  operationId: 'SocialController_people',
  request: { query: peopleQuery },
  responses: {
    200: {
      description: 'People available to follow',
      content: { 'application/json': { schema: peopleListResponse } },
    },
  },
  tags: ['Social'],
});

const personRoute = createRoute({
  method: 'get',
  path: '/people/{id}',
  operationId: 'SocialController_person',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Public person profile',
      content: { 'application/json': { schema: personResponse } },
    },
  },
  tags: ['Social'],
});

const activitiesRoute = createRoute({
  method: 'get',
  path: '/people/{id}/activities',
  operationId: 'SocialController_activities',
  request: { params: idParams, query: ActivityListQuerySchema },
  responses: {
    200: {
      description: 'Visible activities for a person',
      content: { 'application/json': { schema: activityListResponse } },
    },
  },
  tags: ['Social'],
});

const requestsRoute = createRoute({
  method: 'get',
  path: '/follow-requests',
  operationId: 'SocialController_requests',
  request: { query: RequestDirectionQuerySchema },
  responses: {
    200: {
      description: 'Follow requests',
      content: { 'application/json': { schema: requestListResponse } },
    },
  },
  tags: ['Social'],
});

const feedRoute = createRoute({
  method: 'get',
  path: '/feed',
  operationId: 'SocialController_feed',
  request: { query: ActivityListQuerySchema },
  responses: {
    200: {
      description: 'Home feed',
      content: { 'application/json': { schema: activityListResponse } },
    },
  },
  tags: ['Social'],
});

const likersRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/likes',
  operationId: 'SocialController_likers',
  request: { params: idParams },
  responses: {
    200: {
      description: 'People who liked an activity',
      content: { 'application/json': { schema: likerListResponse } },
    },
  },
  tags: ['Social'],
});

const notificationsRoute = createRoute({
  method: 'get',
  path: '/notifications',
  operationId: 'SocialController_notifications',
  request: { query: notificationsQuery },
  responses: {
    200: {
      description: 'Latest notifications',
      content: { 'application/json': { schema: notificationListResponse } },
    },
  },
  tags: ['Social'],
});

const commentsRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/comments',
  operationId: 'SocialController_comments',
  request: { params: idParams, query: commentsQuery },
  responses: {
    200: {
      description: 'Activity comments',
      content: { 'application/json': { schema: commentListResponse } },
    },
  },
  tags: ['Social'],
});

export const registerSocialReadRoutes = (
  app: OpenAPIHono<ApiEnv>,
  social: SocialReadService,
  activities: SocialActivityReadService,
): void => {
  app.openapi(peopleRoute, async (context) => {
    const result = await social.people(context.get('user').id, context.req.valid('query').query);
    return context.json(peopleListResponse.parse(result), 200);
  });
  app.openapi(personRoute, async (context) => {
    const result = await social.person(context.get('user').id, context.req.valid('param').id);
    return context.json(personResponse.parse(result), 200);
  });
  app.openapi(activitiesRoute, async (context) => {
    const result = await activities.profileActivities(
      context.get('user').id,
      context.req.valid('param').id,
      context.req.valid('query'),
    );
    return context.json(activityListResponse.parse(result), 200);
  });
  app.openapi(requestsRoute, async (context) => {
    const result = await social.requests(context.get('user').id, context.req.valid('query').direction);
    return context.json(requestListResponse.parse(result), 200);
  });
  app.openapi(feedRoute, async (context) => {
    const result = await activities.feed(context.get('user').id, context.req.valid('query'));
    return context.json(activityListResponse.parse(result), 200);
  });
  app.openapi(likersRoute, async (context) => {
    const result = await social.likers(context.req.valid('param').id, context.get('user').id);
    return context.json(likerListResponse.parse(result), 200);
  });
  app.openapi(notificationsRoute, async (context) => {
    const { limit } = context.req.valid('query');
    const result = await social.notifications(context.get('user').id, limit);
    return context.json(notificationListResponse.parse(result), 200);
  });
  app.openapi(commentsRoute, async (context) => {
    const { cursor, limit } = context.req.valid('query');
    const result = await social.comments(context.req.valid('param').id, context.get('user').id, cursor, limit);
    return context.json(commentListResponse.parse(result), 200);
  });
};
