import { createRoute, z, type OpenAPIHono } from '@hono/zod-openapi';

import type { ApiEnv, ApiUserLookup } from 'src/api/auth';
import { fileResponse, type FileReader } from 'src/api/file-response';
import { ForbiddenException, NotFoundException } from 'src/errors';
import type { UserService } from 'src/services/user.service';

export type { FileReader } from 'src/api/file-response';

export type UserReadRepository = ApiUserLookup & {
  all: () => Promise<Array<{ password_hash: string }>>;
};
export type UserAvatarService = Pick<UserService, 'avatarAbsolutePath' | 'avatarFile'>;
const avatarParams = z.object({ id: z.string() });
const binaryImageContent = {
  'image/*': { schema: { type: 'string' as const, format: 'binary' as const } },
};

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  operationId: 'UserController_list',
  parameters: [],
  responses: { 200: { description: '' } },
  tags: ['User'],
});

const avatarRoute = createRoute({
  method: 'get',
  path: '/users/{id}/avatar',
  operationId: 'UserController_avatarFile',
  request: { params: avatarParams },
  responses: {
    200: { description: 'Profile picture', content: binaryImageContent },
    206: { description: 'Requested profile picture byte range', content: binaryImageContent },
    304: { description: 'Profile picture was not modified' },
    404: { description: 'Profile picture does not exist' },
    416: { description: 'Requested byte range is not satisfiable' },
  },
  tags: ['User'],
});

export const registerUserReadRoutes = (
  app: OpenAPIHono<ApiEnv>,
  users: UserReadRepository,
  userService: UserAvatarService,
  files: FileReader,
): void => {
  app.openapi(listUsersRoute, async (context) => {
    if (context.get('user').role !== 'admin') {
      throw new ForbiddenException('Administrator access is required');
    }
    const allUsers = await users.all();
    const result = allUsers.map(({ password_hash: _passwordHash, ...user }) => user);
    return context.json(result, 200) as never;
  });
  app.openapi(avatarRoute, async (context) => {
    const avatar = await userService.avatarFile(context.req.valid('param').id, context.get('user').id);
    if (!avatar.avatar_path || !avatar.avatar_mime_type || avatar.avatar_size === null) {
      throw new NotFoundException('Profile picture does not exist');
    }
    return fileResponse(context.req.raw, files, userService.avatarAbsolutePath(avatar.avatar_path), {
      missingMessage: 'Profile picture does not exist',
      headers: {
        'Content-Type': avatar.avatar_mime_type,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    }) as never;
  });
};
