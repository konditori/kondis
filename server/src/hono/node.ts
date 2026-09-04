import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { getRequestListener } from '@hono/node-server';
import { BadRequestException, HttpException, PayloadTooLargeException, type INestApplication } from '@nestjs/common';
import type { Request, RequestHandler, Response } from 'express';
import multer, { diskStorage, memoryStorage } from 'multer';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { API_PREFIX, createHonoApp, type KondisHonoApp } from 'src/hono/app';
import type { HonoBindings } from 'src/hono/auth';
import type { HonoUploadReader, UploadKind } from 'src/hono/uploads';
import type { ConfigPort } from 'src/ports/config.port';
import { UserRepository } from 'src/repositories/user.repository';
import { ActivityService } from 'src/services/activity.service';
import { AuthService } from 'src/services/auth.service';
import { JobService } from 'src/services/job.service';
import { LiveWorkoutService } from 'src/services/live-workout.service';
import { ServerService } from 'src/services/server.service';
import { SocialService } from 'src/services/social.service';
import { UploadService } from 'src/services/upload.service';
import { UserService } from 'src/services/user.service';

const readNodeFile = async (path: string): Promise<ReadableStream> => {
  const file = await open(path, 'r');
  return file.readableWebStream({ autoClose: true }) as unknown as ReadableStream;
};

const uploadStorage = diskStorage({
  destination: tmpdir(),
  filename: (_request, _file, callback) => callback(null, `kondis-upload-${randomUUID()}`),
});
const uploadHandlers: Record<UploadKind, RequestHandler> = {
  activity: multer({
    storage: uploadStorage,
    limits: { fileSize: UPLOAD_LIMITS.activityFileBytes, files: 1, fields: 0, parts: 2 },
  }).single('file'),
  avatar: multer({
    storage: memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.avatarFileBytes, files: 1, fields: 0, parts: 2 },
  }).single('file'),
  takeout: multer({
    storage: uploadStorage,
    limits: { fileSize: UPLOAD_LIMITS.takeoutFileBytes, files: 1, fields: 0, parts: 2 },
  }).single('file'),
};

const asUploadException = (error: unknown): unknown => {
  if (!error || error instanceof HttpException) {
    return error;
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return new PayloadTooLargeException(error.message);
    }
    return new BadRequestException(error.field ? `${error.message} - ${error.field}` : error.message);
  }
  if (
    error instanceof Error &&
    (error.message.startsWith('Multipart:') ||
      ['Malformed part header', 'Unexpected end of form', 'Unexpected end of file'].includes(error.message))
  ) {
    const message = error.message.startsWith('Multipart:') ? error.message : `Multipart: ${error.message}`;
    return new BadRequestException(message);
  }
  return error;
};

export const nodeUploadReader: HonoUploadReader = {
  read: (_request: globalThis.Request, platform: HonoBindings | undefined, kind: UploadKind) => {
    const incoming = platform?.incoming as Request | undefined;
    const outgoing = platform?.outgoing as Response | undefined;
    if (!incoming || !outgoing) {
      return Promise.reject(new Error('The Node upload adapter is unavailable'));
    }
    return new Promise((resolve, reject) => {
      uploadHandlers[kind](incoming, outgoing, (error?: unknown) => {
        if (error) {
          reject(asUploadException(error));
          return;
        }
        if (!incoming.file) {
          resolve(undefined);
          return;
        }
        const { buffer, originalname, path, size } = incoming.file;
        resolve(kind === 'avatar' ? { originalname, size, buffer } : { originalname, size, path });
      });
    });
  },
};

export const createNodeHonoApp = (
  nestApp: INestApplication,
  config: Pick<ConfigPort, 'registrationEnabled'>,
): KondisHonoApp =>
  createHonoApp({
    activities: nestApp.get(ActivityService),
    auth: nestApp.get(AuthService),
    config,
    files: { read: readNodeFile },
    jobs: nestApp.get(JobService),
    liveWorkouts: nestApp.get(LiveWorkoutService),
    server: new ServerService(),
    social: nestApp.get(SocialService),
    uploads: nodeUploadReader,
    uploadService: nestApp.get(UploadService),
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
