import { getRequestListener } from '@hono/node-server';
import type { INestApplication } from '@nestjs/common';
import type { RequestHandler } from 'express';

import { API_PREFIX, type KondisHonoApp } from 'src/hono/app';

const honoRoutes = new Set(['GET /ping']);

export const mountHonoApp = (nestApp: INestApplication, honoApp: KondisHonoApp): void => {
  const listener = getRequestListener(honoApp.fetch, { overrideGlobalObjects: false });
  const middleware: RequestHandler = (request, response, next) => {
    if (!honoRoutes.has(`${request.method} ${request.path}`)) {
      next();
      return;
    }

    void listener(request, response).catch(next);
  };

  nestApp.use(API_PREFIX, middleware);
};
