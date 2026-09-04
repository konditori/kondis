import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { PingResponseSchema } from 'src/dtos/ping.dto';
import { createHonoAuthMiddleware, type HonoAuthEnv, type HonoUserLookup } from 'src/hono/auth';
import { ServerService } from 'src/services/server.service';

export const API_PREFIX = '/api/v1';

type HonoDependencies = {
  server: Pick<ServerService, 'ping'>;
  users: HonoUserLookup;
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

const publicRoutes = new Set([`${pingRoute.method.toUpperCase()} ${pingRoute.path}`]);

export const createHonoApp = ({ server, users }: HonoDependencies) => {
  const app = new OpenAPIHono<HonoAuthEnv>();

  app.use(
    '*',
    createHonoAuthMiddleware(users, (method, path) => publicRoutes.has(`${method} ${path}`)),
  );
  app.openapi(pingRoute, (context) => context.json(server.ping(), 200));
  app.onError((error, context) => {
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
