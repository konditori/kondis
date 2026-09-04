import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { createApiAuthMiddleware, type ApiEnv, type ApiUserLookup } from 'src/api/auth';
import { registerActivityReadRoutes, type ActivityReadService } from 'src/api/routes/activity';
import { registerActivityImageRoutes, type ActivityImageRouteService } from 'src/api/routes/activity-image';
import { registerAuthRoutes, type AuthRouteService } from 'src/api/routes/auth';
import { registerJobRoutes, type JobRouteService } from 'src/api/routes/job';
import { registerLiveWorkoutRoutes, type LiveWorkoutRouteService } from 'src/api/routes/live-workout';
import {
  registerSocialReadRoutes,
  type SocialActivityReadService,
  type SocialReadService,
} from 'src/api/routes/social';
import { registerSocialMutationRoutes, type SocialMutationService } from 'src/api/routes/social-mutations';
import { registerUploadRoutes, type UploadRouteService } from 'src/api/routes/upload';
import {
  registerUserReadRoutes,
  type FileReader,
  type UserAvatarService,
  type UserReadRepository,
} from 'src/api/routes/user';
import {
  registerUserMutationRoutes,
  type UserCreationService,
  type UserMutationService,
} from 'src/api/routes/user-mutations';
import type { UploadReader } from 'src/api/uploads';
import { RequestValidationError } from 'src/api/validation';
import { PingResponseSchema } from 'src/dtos/ping.dto';
import { HttpException } from 'src/errors';
import type { ConfigPort } from 'src/ports/config.port';
import { ServerService } from 'src/services/server.service';

export const API_PREFIX = '/api/v1';

export type ApiDependencies = {
  activities: ActivityReadService & SocialActivityReadService;
  activityImages: ActivityImageRouteService;
  auth: AuthRouteService & UserCreationService;
  config: Pick<ConfigPort, 'registrationEnabled'>;
  files: FileReader;
  jobs: JobRouteService;
  liveWorkouts: LiveWorkoutRouteService;
  server: Pick<ServerService, 'ping'>;
  social: SocialReadService & SocialMutationService;
  uploads: UploadReader;
  uploadService: UploadRouteService;
  userService: UserAvatarService & UserMutationService;
  users: ApiUserLookup & UserReadRepository;
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
]);

export const createApiApp = ({
  activities,
  activityImages,
  auth,
  config,
  files,
  jobs,
  liveWorkouts,
  server,
  social,
  uploads,
  uploadService,
  userService,
  users,
}: ApiDependencies) => {
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
    createApiAuthMiddleware(users, (method, path) => {
      const normalizedMethod = method === 'HEAD' ? 'GET' : method;
      const runtimePath = path.startsWith(`${API_PREFIX}/`) ? path.slice(API_PREFIX.length) : path;
      const normalizedPath = runtimePath.length > 1 ? runtimePath.replace(/\/+$/, '') : runtimePath;
      return (
        publicRoutes.has(`${normalizedMethod} ${normalizedPath}`) ||
        (normalizedMethod === 'GET' && normalizedPath.startsWith('/live-workouts/shared/'))
      );
    }),
  );
  app.openapi(pingRoute, (context) => context.json(server.ping(), 200));
  registerActivityReadRoutes(app, activities);
  registerActivityImageRoutes(app, activityImages, uploads, files);
  registerUserReadRoutes(app, users, userService, files);
  registerSocialReadRoutes(app, social, activities);
  registerAuthRoutes(app, auth, users, config);
  registerUserMutationRoutes(app, auth, userService, uploads);
  registerSocialMutationRoutes(app, social);
  registerLiveWorkoutRoutes(app, liveWorkouts);
  registerUploadRoutes(app, uploadService, uploads);
  registerJobRoutes(app, jobs);
  app.onError((error, context) => {
    if (error instanceof RequestValidationError) {
      return context.json({ statusCode: 400, message: error.message, errors: error.issues }, 400);
    }
    if (error instanceof HttpException) {
      const status = error.getStatus() as ContentfulStatusCode;
      const response = error.getResponse();
      const body = typeof response === 'string' ? { statusCode: status, message: response } : response;
      return context.json(body, status);
    }
    console.error(error);
    return context.json({ statusCode: 500, message: 'Internal server error' }, 500);
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
