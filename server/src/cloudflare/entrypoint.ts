import { OpenAPIHono, createRoute } from '@hono/zod-openapi';

import { PingResponseSchema } from 'src/dtos/ping.dto';

export type WorkerEnv = Record<string, never>;
type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
};

const pingRoute = createRoute({
  method: 'get',
  path: '/api/v1/ping',
  operationId: 'ServerController_ping',
  responses: {
    200: {
      description: 'The API is reachable',
      content: { 'application/json': { schema: PingResponseSchema } },
    },
  },
  summary: 'Health check endpoint',
  tags: ['server'],
});

let app: OpenAPIHono | undefined;

const getApp = (): OpenAPIHono => {
  if (app) {
    return app;
  }

  const nextApp = new OpenAPIHono();
  nextApp.openapi(pingRoute, (context) => context.json({ status: 'pong' }, 200));
  nextApp.get('/api/v1/openapi.json', (context) =>
    context.json(
      nextApp.getOpenAPIDocument({
        openapi: '3.0.0',
        info: { title: 'Kondis API', description: 'Cloudflare Worker API boundary', version: '0.0.0' },
        servers: [{ url: '/api/v1' }],
      }),
    ),
  );

  app = nextApp;
  return nextApp;
};

export default {
  fetch(request: Request, _env: WorkerEnv, _ctx: WorkerExecutionContext): Response | Promise<Response> {
    return getApp().fetch(request);
  },
};
