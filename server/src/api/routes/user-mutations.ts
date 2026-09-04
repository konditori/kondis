import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';

import { requireAdmin, type ApiEnv } from 'src/api/auth';
import type { UploadReader } from 'src/api/uploads';
import { jsonBodyMiddleware, parseRequest } from 'src/api/validation';
import type { AuthService } from 'src/services/auth.service';
import type { UserService } from 'src/services/user.service';

export type UserCreationService = Pick<AuthService, 'create'>;
export type UserMutationService = Pick<UserService, 'clearAvatar' | 'updateProfile' | 'uploadAvatar'>;

const createUserInput = z.object({
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  password: z.string(),
  role: z.enum(['user', 'admin']).default('user'),
});
const updateNameInput = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});
const multipartBody = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object' as const,
        required: ['file'],
        properties: { file: { type: 'string' as const, format: 'binary' } },
      },
    },
  },
};

const createRouteConfig = createRoute({
  method: 'post',
  path: '/users',
  operationId: 'UserController_create',
  middleware: [requireAdmin, jsonBodyMiddleware] as const,
  parameters: [],
  responses: { 201: { description: '' } },
  tags: ['User'],
});
const updateRoute = createRoute({
  method: 'patch',
  path: '/users/me',
  operationId: 'UserController_updateMe',
  middleware: [jsonBodyMiddleware] as const,
  parameters: [],
  responses: { 200: { description: '' } },
  tags: ['User'],
});
const avatarRoute = createRoute({
  method: 'post',
  path: '/users/me/avatar',
  operationId: 'UserController_uploadAvatar',
  parameters: [],
  request: { body: multipartBody },
  responses: { 201: { description: '' } },
  tags: ['User'],
});
const deleteAvatarRoute = createRoute({
  method: 'delete',
  path: '/users/me/avatar',
  operationId: 'UserController_deleteAvatar',
  parameters: [],
  responses: { 204: { description: '' } },
  tags: ['User'],
});

export const registerUserMutationRoutes = (
  app: OpenAPIHono<ApiEnv>,
  auth: UserCreationService,
  users: UserMutationService,
  uploads: UploadReader,
): void => {
  app.openapi(createRouteConfig, async (context) => {
    const value = parseRequest(createUserInput, await context.req.json());
    const { password_hash: _passwordHash, ...user } = await auth.create(
      value.email,
      value.firstName,
      value.lastName,
      value.password,
      value.role,
    );
    return context.json(user, 201) as never;
  });
  app.openapi(updateRoute, async (context) => {
    const value = parseRequest(updateNameInput, await context.req.json());
    return context.json(
      await users.updateProfile(context.get('user').id, value.firstName, value.lastName),
      200,
    ) as never;
  });
  app.openapi(avatarRoute, async (context) => {
    const file = await uploads.read(context.req.raw, context.env, 'avatar');
    return context.json(await users.uploadAvatar(context.get('user').id, file as never), 201) as never;
  });
  app.openapi(deleteAvatarRoute, async (context) => {
    await users.clearAvatar(context.get('user').id);
    return context.body(null, 204);
  });
};
