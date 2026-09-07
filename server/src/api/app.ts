import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { createApiAuthMiddleware, type ApiEnv } from 'src/api/auth';
import type { AuthenticatedUser } from 'src/auth';
import { registerAllRouteGroups, type ApiRouteGroups } from 'src/api/route-groups';
import { RequestValidationError } from 'src/api/validation';
import { PingResponseSchema } from 'src/dtos/ping.dto';
import { HttpException } from 'src/errors';
import { ServerService } from 'src/services/server.service';

export const API_PREFIX = '/api/v1';

export type ApiDependencies = ApiRouteGroups & {
  server: Pick<ServerService, 'ping'>;
};

const pingRoute = createRoute({
  method: 'get',
  path: '/ping',
  operationId: 'ServerController_ping',
  parameters: [],
  responses: {
    200: {
      description: 'The API is reachable',
      content: {
        'application/json': {
          schema: PingResponseSchema,
        },
      },
    },
  },
  summary: 'Health check endpoint',
  tags: ['server'],
});

const publicRoutes = new Set([
  `${pingRoute.method.toUpperCase()} ${pingRoute.path}`,
  'GET /activities/types',
  'GET /auth/capabilities',
  'GET /auth/setup',
  'POST /auth/setup',
  'POST /auth/setup/verify',
  'POST /auth/setup/validate',
  'POST /auth/login',
  'POST /auth/register',
  'POST /_internal/auth-credential-cleanup',
]);

export const createApiShell = (sessions: ApiDependencies['sessions'], demoUser?: AuthenticatedUser) => {
  const app = new OpenAPIHono<ApiEnv>({
    strict: false,
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json({ statusCode: 400, message: 'Validation failed', errors: result.error.issues }, 400);
      }
    },
  });

  app.use(
    '*',
    createApiAuthMiddleware(sessions, (method, path) => {
      const normalizedMethod = method === 'HEAD' ? 'GET' : method;
      const runtimePath = path.startsWith(`${API_PREFIX}/`) ? path.slice(API_PREFIX.length) : path;
      const normalizedPath = runtimePath.length > 1 ? runtimePath.replace(/\/+$/, '') : runtimePath;
      return (
        publicRoutes.has(`${normalizedMethod} ${normalizedPath}`) ||
        (normalizedMethod === 'GET' && normalizedPath.startsWith('/live-workouts/shared/'))
      );
    }, demoUser),
  );

  registerApiErrorHandlers(app);
  return app;
};

export const registerApiErrorHandlers = (app: OpenAPIHono<ApiEnv>) => {
  app.notFound((context) => context.json({ statusCode: 404, message: 'Not Found' }, 404));
  app.onError((error, context) => {
    if (error instanceof RequestValidationError) {
      return context.json({ statusCode: 400, message: error.message, errors: error.issues }, 400);
    }
    if (error instanceof HttpException) {
      const status = error.getStatus() as ContentfulStatusCode;
      const response = error.getResponse();
      const body = typeof response === 'string' ? { statusCode: status, message: response } : response;
      return context.json(body, status, error.getHeaders());
    }
    console.error(error);
    return context.json({ statusCode: 500, message: 'Internal server error' }, 500);
  });
};

export const createApiApp = ({
  activities,
  activityImages,
  auth,
  config,
  files,
  jobs,
  liveWorkouts,
  server,
  sessions,
  social,
  uploads,
  uploadService,
  userService,
  users,
}: ApiDependencies) => {
  const app = createApiShell(sessions);
  app.openapi(pingRoute, (context) => context.json(server.ping(), 200));
  registerAllRouteGroups(app, {
    activities,
    activityImages,
    auth,
    config,
    files,
    jobs,
    liveWorkouts,
    sessions,
    social,
    uploads,
    uploadService,
    userService,
    users,
  });

  return app;
};

export type KondisApiApp = ReturnType<typeof createApiApp>;

export const createOpenApiDocument = (app: KondisApiApp) =>
  app.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      title: 'Kondis API',
      description: 'OpenAPI schema for Kondis',
      version: '0.0.0',
    },
    servers: [{ url: API_PREFIX }],
  });
