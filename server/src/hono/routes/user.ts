import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type { HonoAuthEnv, HonoUserLookup } from 'src/hono/auth';
import type { UserService } from 'src/services/user.service';

export type UserReadRepository = HonoUserLookup & {
  all: () => Promise<Array<{ password_hash: string }>>;
};
export type UserAvatarService = Pick<UserService, 'avatarAbsolutePath' | 'avatarFile'>;
export type FileReader = {
  read: (path: string) => Promise<BodyInit>;
};

const avatarParams = z.object({ id: z.string() });

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
  responses: { 200: { description: '' } },
  tags: ['User'],
});

export const registerUserReadRoutes = (
  app: OpenAPIHono<HonoAuthEnv>,
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
    const body =
      context.req.method === 'HEAD' ? null : await files.read(userService.avatarAbsolutePath(avatar.avatar_path));
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': avatar.avatar_mime_type,
        'Content-Length': String(avatar.avatar_size),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    }) as never;
  });
};
