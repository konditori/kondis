import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import {
  CommentCreateSchema,
  CommentSchema,
  CommentUpdateSchema,
  LikeStateSchema,
  NotificationsReadSchema,
} from 'src/dtos/social.dto';
import type { HonoAuthEnv } from 'src/hono/auth';
import { jsonBodyMiddleware } from 'src/hono/validation';
import type { SocialService } from 'src/services/social.service';

export type SocialMutationService = Pick<
  SocialService,
  | 'acceptRequest'
  | 'addComment'
  | 'block'
  | 'cancelRequest'
  | 'deleteComment'
  | 'ignoreRequest'
  | 'like'
  | 'markNotificationsRead'
  | 'sendRequest'
  | 'unblock'
  | 'unfollow'
  | 'updateComment'
>;

const idParams = z.object({ id: z.string() });
const commentParams = z.object({ activityId: z.string(), commentId: z.string() });
const emptyResponse = (status: 200 | 201) => ({ [status]: { description: '' } });
const relationRoute = (method: 'delete' | 'post' | 'put', path: string, operationId: string, status: 200 | 201) =>
  createRoute({
    method,
    path,
    operationId,
    request: { params: idParams },
    responses: emptyResponse(status),
    tags: ['Social'],
  });

const sendRoute = relationRoute('post', '/people/{id}/follow-request', 'SocialController_send', 201);
const cancelRoute = relationRoute('delete', '/people/{id}/follow-request', 'SocialController_cancel', 200);
const unfollowRoute = relationRoute('delete', '/people/{id}/follow', 'SocialController_unfollow', 200);
const blockRoute = relationRoute('put', '/people/{id}/block', 'SocialController_block', 200);
const unblockRoute = relationRoute('delete', '/people/{id}/block', 'SocialController_unblock', 200);
const acceptRoute = relationRoute('post', '/follow-requests/{id}/accept', 'SocialController_accept', 201);
const ignoreRoute = relationRoute('delete', '/follow-requests/{id}', 'SocialController_ignore', 200);
const likeResponse = LikeStateSchema.openapi('LikeStateDto_Output');
const likeRoute = createRoute({
  method: 'put',
  path: '/activities/{id}/like',
  operationId: 'SocialController_like',
  request: { params: idParams },
  responses: {
    200: { description: 'Like an activity', content: { 'application/json': { schema: likeResponse } } },
  },
  tags: ['Social'],
});
const unlikeRoute = createRoute({
  method: 'delete',
  path: '/activities/{id}/like',
  operationId: 'SocialController_unlike',
  request: { params: idParams },
  responses: {
    200: { description: 'Unlike an activity', content: { 'application/json': { schema: likeResponse } } },
  },
  tags: ['Social'],
});
const notificationsReadResponse = NotificationsReadSchema.openapi('NotificationsReadDto_Output');
const markNotificationsReadRoute = createRoute({
  method: 'patch',
  path: '/notifications/read',
  operationId: 'SocialController_markNotificationsRead',
  parameters: [],
  responses: {
    200: {
      description: 'Mark notifications as read',
      content: { 'application/json': { schema: notificationsReadResponse } },
    },
  },
  tags: ['Social'],
});
const commentResponse = CommentSchema.openapi('CommentDto_Output');
const commentCreateInput = CommentCreateSchema.openapi('CommentCreateDto');
const commentUpdateInput = CommentUpdateSchema.openapi('CommentUpdateDto');
const commentRoute = createRoute({
  method: 'post',
  path: '/activities/{id}/comments',
  operationId: 'SocialController_comment',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: idParams,
    body: { required: true, content: { 'application/json': { schema: commentCreateInput } } },
  },
  responses: {
    201: { description: 'Add an activity comment', content: { 'application/json': { schema: commentResponse } } },
  },
  tags: ['Social'],
});
const updateCommentRoute = createRoute({
  method: 'patch',
  path: '/activities/{activityId}/comments/{commentId}',
  operationId: 'SocialController_updateComment',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: commentParams,
    body: { required: true, content: { 'application/json': { schema: commentUpdateInput } } },
  },
  responses: {
    200: { description: 'Edit an activity comment', content: { 'application/json': { schema: commentResponse } } },
  },
  tags: ['Social'],
});
const deleteCommentRoute = createRoute({
  method: 'delete',
  path: '/activities/{activityId}/comments/{commentId}',
  operationId: 'SocialController_deleteComment',
  request: { params: commentParams },
  responses: emptyResponse(200),
  tags: ['Social'],
});

const response = (
  context: {
    body: (body: null, status: 200 | 201) => Response;
    json: (body: unknown, status: 200 | 201) => Response;
  },
  value: unknown,
  status: 200 | 201,
) => (value === undefined ? context.body(null, status) : context.json(value, status));

export const registerSocialMutationRoutes = (app: OpenAPIHono<HonoAuthEnv>, service: SocialMutationService): void => {
  app.openapi(
    sendRoute,
    async (context) =>
      response(context, await service.sendRequest(context.get('user').id, context.req.valid('param').id), 201) as never,
  );
  app.openapi(
    cancelRoute,
    async (context) =>
      response(
        context,
        await service.cancelRequest(context.get('user').id, context.req.valid('param').id),
        200,
      ) as never,
  );
  app.openapi(
    unfollowRoute,
    async (context) =>
      response(context, await service.unfollow(context.get('user').id, context.req.valid('param').id), 200) as never,
  );
  app.openapi(
    blockRoute,
    async (context) =>
      response(context, await service.block(context.get('user').id, context.req.valid('param').id), 200) as never,
  );
  app.openapi(
    unblockRoute,
    async (context) =>
      response(context, await service.unblock(context.get('user').id, context.req.valid('param').id), 200) as never,
  );
  app.openapi(
    acceptRoute,
    async (context) =>
      response(
        context,
        await service.acceptRequest(context.get('user').id, context.req.valid('param').id),
        201,
      ) as never,
  );
  app.openapi(
    ignoreRoute,
    async (context) =>
      response(
        context,
        await service.ignoreRequest(context.get('user').id, context.req.valid('param').id),
        200,
      ) as never,
  );
  app.openapi(likeRoute, async (context) =>
    context.json(
      likeResponse.parse(await service.like(context.req.valid('param').id, context.get('user').id, true)),
      200,
    ),
  );
  app.openapi(unlikeRoute, async (context) =>
    context.json(
      likeResponse.parse(await service.like(context.req.valid('param').id, context.get('user').id, false)),
      200,
    ),
  );
  app.openapi(markNotificationsReadRoute, async (context) =>
    context.json(notificationsReadResponse.parse(await service.markNotificationsRead(context.get('user').id)), 200),
  );
  app.openapi(commentRoute, async (context) =>
    context.json(
      commentResponse.parse(
        await service.addComment(context.req.valid('param').id, context.get('user').id, context.req.valid('json').body),
      ),
      201,
    ),
  );
  app.openapi(updateCommentRoute, async (context) => {
    const { activityId, commentId } = context.req.valid('param');
    return context.json(
      commentResponse.parse(
        await service.updateComment(activityId, commentId, context.get('user').id, context.req.valid('json').body),
      ),
      200,
    );
  });
  app.openapi(deleteCommentRoute, async (context) => {
    const { activityId, commentId } = context.req.valid('param');
    return response(context, await service.deleteComment(activityId, commentId, context.get('user').id), 200) as never;
  });
};
