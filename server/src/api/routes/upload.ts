import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import type { TakeoutActivityUpload, UploadReader } from 'src/api/uploads';
import {
  FitUploadResponseSchema,
  TakeoutActivityMetadataSchema,
  TakeoutFinalizeSchema,
  TakeoutImportCreateResponseSchema,
  TakeoutImportScanResponseSchema,
  TakeoutImportScanSchema,
  TakeoutImportStatusSchema,
  TakeoutItemFailureSchema,
  TakeoutItemSubmissionResponseSchema,
  TakeoutManualItemSchema,
} from 'src/dtos/upload.dto';
import { BadRequestException, NotFoundException } from 'src/errors';
import type { UploadedFileData } from 'src/types/uploads';

export type ActivityUploadRouteService = {
  uploadActivity(file: UploadedFileData | undefined, userId: string): Promise<{ byteSize: number; queued: true }>;
};

export type TakeoutImportRouteService = {
  createTakeoutImport: (userId: string) => Promise<{ importId: string; status: 'scanning' }>;
  scanTakeoutImport: (
    importId: string,
    userId: string,
    scan: z.output<typeof TakeoutImportScanSchema>,
  ) => Promise<string[]>;
  submitTakeoutActivity: (
    importId: string,
    userId: string,
    metadata: z.output<typeof TakeoutActivityMetadataSchema>,
    file: UploadedFileData | undefined,
  ) => Promise<boolean>;
  submitTakeoutManual: (
    importId: string,
    userId: string,
    item: z.output<typeof TakeoutManualItemSchema>,
  ) => Promise<boolean>;
  finalizeTakeoutImport: (importId: string, userId: string, extractionErrors: number) => Promise<unknown>;
  cancelTakeoutImport: (importId: string, userId: string) => Promise<boolean>;
  failTakeoutItem: (importId: string, userId: string, itemKey: string, error: string) => Promise<boolean>;
  getTakeoutImportStatus: (id: string, userId: string) => Promise<z.output<typeof TakeoutImportStatusSchema>>;
};

export type UploadRouteService = ActivityUploadRouteService & TakeoutImportRouteService;

const idParams = z.object({ id: z.string().uuid() });
const activityResponse = FitUploadResponseSchema.openapi('FitUploadResponseDto_Output');
const createResponse = TakeoutImportCreateResponseSchema.openapi('TakeoutImportCreateResponseDto_Output');
const scanResponse = TakeoutImportScanResponseSchema.openapi('TakeoutImportScanResponseDto_Output');
const itemResponse = TakeoutItemSubmissionResponseSchema.openapi('TakeoutItemSubmissionResponseDto_Output');
const statusResponse = TakeoutImportStatusSchema.openapi('TakeoutImportStatusDto_Output');

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

const createImportRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports',
  operationId: 'TakeoutImportController_create',
  responses: {
    201: {
      description: 'Browser extraction import created',
      content: { 'application/json': { schema: createResponse } },
    },
  },
  summary: 'Create a browser-extracted Strava takeout import',
  tags: ['uploads'],
});
const scanImportRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports/{id}/scan',
  operationId: 'TakeoutImportController_scan',
  request: { params: idParams, body: { content: { 'application/json': { schema: TakeoutImportScanSchema } } } },
  responses: {
    200: { description: 'Manifest checkpoints recorded', content: { 'application/json': { schema: scanResponse } } },
  },
  summary: 'Record validated takeout manifest rows',
  tags: ['uploads'],
});
const uploadTakeoutActivityRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports/{id}/activities',
  operationId: 'TakeoutImportController_uploadActivity',
  request: {
    params: idParams,
    body: {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file', 'metadata'],
            properties: {
              file: { type: 'string', format: 'binary', description: 'One extracted .fit, .tcx, or .gpx activity file' },
              metadata: { type: 'string', maxLength: 16 * 1024 },
            },
          },
        },
      },
    },
  },
  responses: {
    202: { description: 'Extracted activity accepted', content: { 'application/json': { schema: itemResponse } } },
  },
  summary: 'Upload one extracted Strava activity',
  tags: ['uploads'],
});
const submitManualRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports/{id}/manual-activities',
  operationId: 'TakeoutImportController_submitManual',
  request: { params: idParams, body: { content: { 'application/json': { schema: TakeoutManualItemSchema } } } },
  responses: {
    202: { description: 'Manual activity accepted', content: { 'application/json': { schema: itemResponse } } },
  },
  summary: 'Submit one manual Strava activity',
  tags: ['uploads'],
});
const finalizeRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports/{id}/finalize',
  operationId: 'TakeoutImportController_finalize',
  request: { params: idParams, body: { content: { 'application/json': { schema: TakeoutFinalizeSchema } } } },
  responses: {
    200: { description: 'Extraction is complete', content: { 'application/json': { schema: statusResponse } } },
  },
  summary: 'Mark browser extraction complete',
  tags: ['uploads'],
});
const failItemRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports/{id}/items/fail',
  operationId: 'TakeoutImportController_failItem',
  request: { params: idParams, body: { content: { 'application/json': { schema: TakeoutItemFailureSchema } } } },
  responses: {
    202: { description: 'Extraction failure checkpointed', content: { 'application/json': { schema: itemResponse } } },
  },
  summary: 'Record an extraction failure for one takeout item',
  tags: ['uploads'],
});
const cancelRoute = createRoute({
  method: 'post',
  path: '/upload/strava/imports/{id}/cancel',
  operationId: 'TakeoutImportController_cancel',
  request: { params: idParams },
  responses: { 204: { description: 'Import cancelled' } },
  summary: 'Cancel a takeout import',
  tags: ['uploads'],
});
const statusRoute = createRoute({
  method: 'get',
  path: '/upload/strava/imports/{id}',
  operationId: 'TakeoutImportController_getStatus',
  request: { params: idParams },
  responses: {
    200: { description: 'Current import progress', content: { 'application/json': { schema: statusResponse } } },
  },
  summary: 'Get browser takeout import progress',
  tags: ['uploads'],
});

export const registerActivityUploadRoute = (
  app: OpenAPIHono<ApiEnv>,
  service: ActivityUploadRouteService,
  uploads: UploadReader,
): void => {
  app.openapi(activityRoute, async (context) => {
    const file = (await uploads.read(context.req.raw, context.env, 'activity')) as UploadedFileData | undefined;
    return context.json(activityResponse.parse(await service.uploadActivity(file, context.get('user').id)), 201);
  });
};

export const registerTakeoutImportRoutes = (
  app: OpenAPIHono<ApiEnv>,
  service: TakeoutImportRouteService,
  uploads: UploadReader,
): void => {
  app.openapi(createImportRoute, async (context) =>
    context.json(createResponse.parse(await service.createTakeoutImport(context.get('user').id)), 201),
  );
  app.openapi(scanImportRoute, async (context) =>
    context.json(
      scanResponse.parse({
        pendingItemKeys: await service.scanTakeoutImport(
          context.req.valid('param').id,
          context.get('user').id,
          context.req.valid('json'),
        ),
      }),
      200,
    ),
  );
  app.openapi(uploadTakeoutActivityRoute, async (context) => {
    const upload = (await uploads.read(context.req.raw, context.env, 'takeoutActivity')) as TakeoutActivityUpload | undefined;
    const rawMetadata = upload?.metadata;
    let metadata: z.output<typeof TakeoutActivityMetadataSchema>;
    try {
      metadata = TakeoutActivityMetadataSchema.parse(JSON.parse(rawMetadata ?? ''));
    } catch {
      throw new BadRequestException('Invalid takeout metadata field');
    }
    return context.json(
      itemResponse.parse({
        accepted: await service.submitTakeoutActivity(
          context.req.valid('param').id,
          context.get('user').id,
          metadata,
          upload?.file,
        ),
      }),
      202,
    );
  });
  app.openapi(submitManualRoute, async (context) =>
    context.json(
      itemResponse.parse({
        accepted: await service.submitTakeoutManual(
          context.req.valid('param').id,
          context.get('user').id,
          context.req.valid('json'),
        ),
      }),
      202,
    ),
  );
  app.openapi(finalizeRoute, async (context) => {
    const result = await service.finalizeTakeoutImport(
      context.req.valid('param').id,
      context.get('user').id,
      context.req.valid('json').extractionErrors,
    );
    if (!result) {
      throw new NotFoundException('Takeout import not found');
    }
    return context.json(statusResponse.parse(result), 200);
  });
  app.openapi(failItemRoute, async (context) =>
    context.json(
      itemResponse.parse({
        accepted: await service.failTakeoutItem(
          context.req.valid('param').id,
          context.get('user').id,
          context.req.valid('json').itemKey,
          context.req.valid('json').error,
        ),
      }),
      202,
    ),
  );
  app.openapi(cancelRoute, async (context) => {
    if (!(await service.cancelTakeoutImport(context.req.valid('param').id, context.get('user').id))) {
      throw new NotFoundException('Takeout import not found');
    }
    return context.body(null, 204);
  });
  app.openapi(statusRoute, async (context) =>
    context.json(
      statusResponse.parse(await service.getTakeoutImportStatus(context.req.valid('param').id, context.get('user').id)),
      200,
    ),
  );
};

export const registerUploadRoutes = (
  app: OpenAPIHono<ApiEnv>,
  service: UploadRouteService,
  uploads: UploadReader,
): void => {
  registerActivityUploadRoute(app, service, uploads);
  registerTakeoutImportRoutes(app, service, uploads);
};
