import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import type { ExecutionContext } from 'hono';

import { runHyperdriveSpike } from 'src/cloudflare/hyperdrive-spike';
import { PingResponseSchema } from 'src/dtos/ping.dto';

export type WorkerEnv = {
  HYPERDRIVE: { connectionString: string };
  HYPERDRIVE_SPIKE_TOKEN?: string;
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

type WorkerApp = OpenAPIHono<{ Bindings: WorkerEnv }>;
let app: WorkerApp | undefined;

const getApp = (): WorkerApp => {
  if (app) {
    return app;
  }

  const nextApp = new OpenAPIHono<{ Bindings: WorkerEnv }>();
  nextApp.openapi(pingRoute, (context) => context.json({ status: 'pong' }, 200));
  nextApp.get('/api/v1/_internal/hyperdrive-spike', async (context) => {
    const env = context.env;
    if (!env.HYPERDRIVE || !env.HYPERDRIVE_SPIKE_TOKEN) {
      return context.json({ statusCode: 404, message: 'Not Found' }, 404);
    }
    if (context.req.header('Authorization') !== `Bearer ${env.HYPERDRIVE_SPIKE_TOKEN}`) {
      return context.json({ statusCode: 401, message: 'Unauthorized' }, 401);
    }

    try {
      return context.json(await runHyperdriveSpike(env.HYPERDRIVE.connectionString), 200);
    } catch (error) {
      console.error('Hyperdrive spike failed', error);
      return context.json({ statusCode: 502, message: 'Hyperdrive spike failed' }, 502);
    }
  });
  nextApp.get('/api/v1/openapi.json', (context) =>
    context.json(
      nextApp.getOpenAPIDocument({
        openapi: '3.0.0',
        info: {
          title: 'Kondis API',
          description: 'Cloudflare Worker API boundary',
          version: '0.0.0',
        },
        servers: [{ url: '/api/v1' }],
      }),
    ),
  );

  app = nextApp;
  return nextApp;
};

export default {
  fetch(request: Request, env: WorkerEnv, _ctx: ExecutionContext): Response | Promise<Response> {
    return getApp().fetch(request, env, _ctx);
  },
};
