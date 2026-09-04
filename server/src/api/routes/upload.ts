import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import type { UploadReader } from 'src/api/uploads';
import {
  FitUploadResponseSchema,
  LagomTakeoutUploadResponseSchema,
  TakeoutImportStatusSchema,
} from 'src/dtos/upload.dto';
import type { UploadService } from 'src/services/upload.service';
import type { UploadedFileData } from 'src/types/uploads';

export type UploadRouteService = Pick<UploadService, 'getLagomTakeoutStatus' | 'uploadActivity' | 'uploadLagomTakeout'>;

const uploadBody = (description: string) => ({
  required: true as const,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object' as const,
        required: ['file'],
        properties: { file: { type: 'string' as const, format: 'binary', description } },
      },
    },
  },
});
const idParams = z.object({ id: z.string() });
const activityResponse = FitUploadResponseSchema.openapi('FitUploadResponseDto_Output');
const takeoutResponse = LagomTakeoutUploadResponseSchema.openapi('LagomTakeoutUploadResponseDto_Output');
const statusResponse = TakeoutImportStatusSchema.openapi('TakeoutImportStatusDto_Output');

const activityRoute = createRoute({
  method: 'post',
  path: '/upload/activity',
  operationId: 'UploadController_uploadActivity',
  parameters: [],
  request: { body: uploadBody('.fit, .tcx, or .gpx activity file') },
  responses: {
    201: {
      description: 'Activity file processing is queued and happens asynchronously',
      content: { 'application/json': { schema: activityResponse } },
    },
  },
  summary: 'Upload a FIT, TCX, or GPX activity file',
  tags: ['uploads'],
});
const takeoutRoute = createRoute({
  method: 'post',
  path: '/upload/strava',
  operationId: 'UploadController_uploadStravaTakeout',
  parameters: [],
  request: { body: uploadBody('Strava takeout .zip file') },
  responses: {
    201: {
      description: 'Takeout importing and activity parsing are queued and happen asynchronously',
      content: { 'application/json': { schema: takeoutResponse } },
    },
  },
  summary: 'Import activities from a Strava takeout ZIP archive',
  tags: ['uploads'],
});
const statusRoute = createRoute({
  method: 'get',
  path: '/upload/strava/{id}',
  operationId: 'UploadController_getStravaTakeoutStatus',
  request: { params: idParams },
  responses: {
    200: {
      description: 'Current import progress',
      content: { 'application/json': { schema: statusResponse } },
    },
  },
  summary: 'Get Strava takeout import progress',
  tags: ['uploads'],
});

export const registerUploadRoutes = (
  app: OpenAPIHono<ApiEnv>,
  service: UploadRouteService,
  uploads: UploadReader,
): void => {
  app.openapi(activityRoute, async (context) => {
    const file = (await uploads.read(context.req.raw, context.env, 'activity')) as UploadedFileData | undefined;
    return context.json(activityResponse.parse(await service.uploadActivity(file, context.get('user').id)), 201);
  });
  app.openapi(takeoutRoute, async (context) => {
    const file = (await uploads.read(context.req.raw, context.env, 'takeout')) as UploadedFileData | undefined;
    return context.json(takeoutResponse.parse(await service.uploadLagomTakeout(file, context.get('user').id)), 201);
  });
  app.openapi(statusRoute, async (context) =>
    context.json(
      statusResponse.parse(await service.getLagomTakeoutStatus(context.req.valid('param').id, context.get('user').id)),
      200,
    ),
  );
};
