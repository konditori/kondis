import { open } from 'node:fs/promises';

import { getRequestListener } from '@hono/node-server';
import type { INestApplication } from '@nestjs/common';
import type { RequestHandler } from 'express';

import { API_PREFIX, createHonoApp, type KondisHonoApp } from 'src/hono/app';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityService } from 'src/services/activity.service';
import { ServerService } from 'src/services/server.service';
import { SocialService } from 'src/services/social.service';
import { UserService } from 'src/services/user.service';

const readNodeFile = async (path: string): Promise<ReadableStream> => {
  const file = await open(path, 'r');
  return file.readableWebStream({ autoClose: true }) as unknown as ReadableStream;
};

export const createNodeHonoApp = (nestApp: INestApplication): KondisHonoApp =>
  createHonoApp({
    activities: nestApp.get(ActivityService),
    files: { read: readNodeFile },
    server: new ServerService(),
    social: nestApp.get(SocialService),
    userService: nestApp.get(UserService),
    users: nestApp.get(UserRepository),
  });

export const mountHonoApp = (nestApp: INestApplication, honoApp: KondisHonoApp): void => {
  const listener = getRequestListener(honoApp.fetch, { overrideGlobalObjects: false });
  const middleware: RequestHandler = (request, response, next) => {
    const method = request.method === 'HEAD' ? 'GET' : request.method;
    const path = request.path.length > 1 ? request.path.replace(/\/+$/, '') : request.path;
    const [matches] = honoApp.router.match(method, path);
    if (matches.every((match) => match[0][1].method !== method)) {
      next();
      return;
    }

    void listener(request, response).catch(next);
  };

  nestApp.use(API_PREFIX, middleware);
};
