import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';

import { createAdaptorServer } from '@hono/node-server';
import type { Request, RequestHandler, Response } from 'express';
import { Hono } from 'hono';
import multer, { diskStorage, memoryStorage } from 'multer';

import { API_PREFIX, createApiApp, type KondisApiApp } from 'src/api/app';
import type { ApiBindings, ApiEnv } from 'src/api/auth';
import type { FileRange, OpenFile } from 'src/api/file-response';
import type { ImageUpload, UploadKind, UploadReader } from 'src/api/uploads';
import type { ApplicationComposition } from 'src/composition.node';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { BadRequestException, HttpException, PayloadTooLargeException } from 'src/errors';
import type { UploadedFileData } from 'src/types/uploads';

const openNodeFile = async (path: string): Promise<OpenFile> => {
  const file = await open(path, 'r');
  try {
    const stats = await file.stat();
    return {
      size: stats.size,
      lastModified: stats.mtime,
      close: () => file.close(),
      stream: (range?: FileRange, signal?: AbortSignal) => {
        const stream = file.createReadStream({
          autoClose: true,
          signal,
          ...(range && { start: range.start, end: range.end }),
        });
        return Readable.toWeb(stream) as unknown as ReadableStream;
      },
    };
  } catch (error) {
    await file.close().catch(() => null);
    throw error;
  }
};

export const nodeFileReader = { open: openNodeFile };

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
  image: multer({
    storage: memoryStorage(),
    limits: { fileSize: UPLOAD_LIMITS.imageFileBytes, files: 1, fields: 1 },
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

function readNodeUpload(
  _request: globalThis.Request,
  platform: ApiBindings | undefined,
  kind: UploadKind,
): Promise<ImageUpload | UploadedFileData | undefined> {
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
      const caption = typeof incoming.body?.caption === 'string' ? incoming.body.caption : undefined;
      if (!incoming.file) {
        resolve(kind === 'image' ? { file: undefined, caption } : undefined);
        return;
      }
      const { buffer, originalname, path, size } = incoming.file;
      if (kind === 'image') {
        resolve({ file: { originalname, size, buffer }, caption });
        return;
      }
      resolve(kind === 'avatar' ? { originalname, size, buffer } : { originalname, size, path });
    });
  });
}

export const nodeUploadReader: UploadReader = { read: readNodeUpload };

type NodeApiDependencies = Pick<
  ApplicationComposition,
  | 'activityService'
  | 'activityImageService'
  | 'authService'
  | 'authCredentialRepository'
  | 'configRepository'
  | 'jobService'
  | 'liveWorkoutService'
  | 'serverService'
  | 'socialService'
  | 'uploadService'
  | 'userRepository'
  | 'userService'
>;

export const createNodeApiApp = (dependencies: NodeApiDependencies): KondisApiApp =>
  createApiApp({
    activities: dependencies.activityService,
    activityImages: dependencies.activityImageService,
    auth: dependencies.authService,
    config: dependencies.configRepository,
    files: nodeFileReader,
    jobs: dependencies.jobService,
    liveWorkouts: dependencies.liveWorkoutService,
    server: dependencies.serverService,
    sessions: dependencies.authCredentialRepository,
    social: dependencies.socialService,
    uploads: nodeUploadReader,
    uploadService: dependencies.uploadService,
    userService: dependencies.userService,
    users: dependencies.userRepository,
  });

export const createNodeServer = (apiApp: KondisApiApp): Server => {
  const runtimeApp = new Hono<ApiEnv>({ strict: false });
  runtimeApp.route(API_PREFIX, apiApp);
  return createAdaptorServer({ fetch: runtimeApp.fetch, overrideGlobalObjects: false }) as Server;
};
