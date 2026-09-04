import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { HttpException } from '@nestjs/common';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { PingResponseSchema } from 'src/dtos/ping.dto';
import { createHonoAuthMiddleware, type HonoAuthEnv, type HonoUserLookup } from 'src/hono/auth';
import { registerActivityReadRoutes, type ActivityReadService } from 'src/hono/routes/activity';
import {
  registerSocialReadRoutes,
  type SocialActivityReadService,
  type SocialReadService,
} from 'src/hono/routes/social';
import {
  registerUserReadRoutes,
  type FileReader,
  type UserAvatarService,
  type UserReadRepository,
} from 'src/hono/routes/user';
import { ServerService } from 'src/services/server.service';

export const API_PREFIX = '/api/v1';

export type HonoDependencies = {
  activities: ActivityReadService & SocialActivityReadService;
  files: FileReader;
  server: Pick<ServerService, 'ping'>;
  social: SocialReadService;
  userService: UserAvatarService;
  users: HonoUserLookup & UserReadRepository;
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

const publicRoutes = new Set([`${pingRoute.method.toUpperCase()} ${pingRoute.path}`, 'GET /activities/types']);

export const createHonoApp = ({ activities, files, server, social, userService, users }: HonoDependencies) => {
  const app = new OpenAPIHono<HonoAuthEnv>({
    strict: false,
    defaultHook: (result, context) => {
      if (!result.success) {
        return context.json({ statusCode: 400, message: 'Validation failed', errors: result.error.issues }, 400);
      }
    },
  });

  app.use(
    '*',
    createHonoAuthMiddleware(users, (method, path) => {
      const normalizedMethod = method === 'HEAD' ? 'GET' : method;
      const normalizedPath = path.length > 1 ? path.replace(/\/+$/, '') : path;
      return publicRoutes.has(`${normalizedMethod} ${normalizedPath}`);
    }),
  );
  app.openapi(pingRoute, (context) => context.json(server.ping(), 200));
  registerActivityReadRoutes(app, activities);
  registerUserReadRoutes(app, users, userService, files);
  registerSocialReadRoutes(app, social, activities);
  app.onError((error, context) => {
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

export type KondisHonoApp = ReturnType<typeof createHonoApp>;

export const createHonoOpenApiDocument = (app: KondisHonoApp) =>
  app.getOpenAPIDocument({
    openapi: '3.0.0',
    info: {
      title: 'Kondis API',
      description: 'OpenAPI schema for Kondis',
      version: '0.0.0',
    },
    servers: [{ url: API_PREFIX }],
  });
