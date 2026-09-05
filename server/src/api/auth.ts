import { createMiddleware } from 'hono/factory';

import { getAccessToken, type AuthenticatedUser } from 'src/auth';
import { ForbiddenException } from 'src/errors';
import type { AuthenticatedSession } from 'src/repositories/auth-credential.repository';

export type ApiEnv = {
  Bindings: ApiBindings;
  Variables: {
    sessionId: string;
    user: AuthenticatedUser;
  };
};

export type ApiBindings = {
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
export type ApiUserLookup = {
  findById: (id: string) => Promise<StoredUser | undefined>;
};
export type ApiSessionLookup = {
  findSession: (token: string) => Promise<AuthenticatedSession | undefined>;
};

export const createApiAuthMiddleware = (sessions: ApiSessionLookup, isPublic: IsPublicRequest) =>
  createMiddleware<ApiEnv>(async (context, next) => {
    if (context.req.matchedRoutes.every(({ method }) => method === 'ALL')) {
      await next();
      return;
    }
    if (isPublic(context.req.method, context.req.path)) {
      await next();
      return;
    }

    const token = getAccessToken({
      authorization: context.req.header('Authorization'),
      cookie: context.req.header('Cookie'),
      kondisAuthorization: context.req.header('X-Kondis-Authorization'),
    });
    if (!token) {
      return context.json({ message: 'Sign in is required', error: 'Unauthorized', statusCode: 401 }, 401);
    }

    const session = await sessions.findSession(token);
    if (!session) {
      return context.json({ message: 'Invalid or expired access token', error: 'Unauthorized', statusCode: 401 }, 401);
    }

    context.set('user', session.user);
    context.set('sessionId', session.id);
    await next();
  });

export const requireAdmin = createMiddleware<ApiEnv>(async (context, next) => {
  if (context.get('user').role !== 'admin') {
    throw new ForbiddenException('Administrator access is required');
  }
  await next();
});
