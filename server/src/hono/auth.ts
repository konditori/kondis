import { ForbiddenException } from '@nestjs/common';
import { createMiddleware } from 'hono/factory';

import { AUTH_SECRET, type AuthenticatedUser, verifyAccessToken } from 'src/auth';

export type HonoAuthEnv = {
  Bindings: HonoBindings;
  Variables: {
    user: AuthenticatedUser;
  };
};

export type HonoBindings = {
  incoming?: { socket?: { remoteAddress?: string } };
  outgoing?: unknown;
};

type IsPublicRequest = (method: string, path: string) => boolean;
type StoredUser = {
  id: string;
  email: string;
  role: 'admin' | 'user';
  first_name: string;
  last_name: string;
  avatar_path?: string | null;
};
export type HonoUserLookup = {
  findById: (id: string) => Promise<StoredUser | undefined>;
};

export const createHonoAuthMiddleware = (users: HonoUserLookup, isPublic: IsPublicRequest) =>
  createMiddleware<HonoAuthEnv>(async (context, next) => {
    if (isPublic(context.req.method, context.req.path)) {
      await next();
      return;
    }

    const verification = verifyAccessToken(
      {
        authorization: context.req.header('Authorization'),
        cookie: context.req.header('Cookie'),
        kondisAuthorization: context.req.header('X-Kondis-Authorization'),
      },
      AUTH_SECRET,
    );
    if (!verification.authenticated) {
      return context.json({ message: verification.message, error: 'Unauthorized', statusCode: 401 }, 401);
    }

    const stored = await users.findById(verification.user.id);
    if (!stored) {
      return context.json({ message: 'Account no longer exists', error: 'Unauthorized', statusCode: 401 }, 401);
    }

    context.set('user', {
      id: stored.id,
      email: stored.email,
      role: stored.role,
      firstName: stored.first_name,
      lastName: stored.last_name,
    });
    await next();
  });

export const requireAdmin = createMiddleware<HonoAuthEnv>(async (context, next) => {
  if (context.get('user').role !== 'admin') {
    throw new ForbiddenException('Administrator access is required');
  }
  await next();
});
