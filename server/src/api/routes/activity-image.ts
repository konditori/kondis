import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import { fileResponse, type FileReader } from 'src/api/file-response';
import type { ImageUpload, UploadReader } from 'src/api/uploads';
import { jsonBodyMiddleware } from 'src/api/validation';
import { ActivityImageListSchema, ActivityImageSchema, ActivityImageUpdateSchema } from 'src/dtos/activity-image.dto';
import { NotFoundException } from 'src/errors';
import type { ActivityImageService } from 'src/services/activity-image.service';

export type ActivityImageRouteService = Pick<ActivityImageService, 'delete' | 'getFile' | 'list' | 'update' | 'upload'>;

const activityParams = z.object({ id: z.string() });
const imageParams = z.object({ activityId: z.string(), imageId: z.string() });
const fileParams = z.object({ imageId: z.string(), variant: z.string() });
const activityImageResponse = ActivityImageSchema.openapi('ActivityImageDto_Output');
const activityImageListResponse = ActivityImageListSchema.openapi('ActivityImageListDto_Output');
const activityImageUpdateInput = ActivityImageUpdateSchema.openapi('ActivityImageUpdateDto');
const multipartBody = {
  required: true,
  content: {
    'multipart/form-data': {
      schema: {
        type: 'object' as const,
        required: ['file'],
        properties: {
          file: { type: 'string' as const, format: 'binary' },
          caption: { type: 'string' as const },
        },
      },
    },
  },
};

const uploadRoute = createRoute({
  method: 'post',
  path: '/activities/{id}/images',
  operationId: 'ActivityImageController_upload',
  request: { params: activityParams, body: multipartBody },
  responses: {
    201: {
      description: 'Image processing was queued',
      content: { 'application/json': { schema: activityImageResponse } },
    },
  },
  summary: 'Upload an image to an activity',
  tags: ['activity-images'],
});

const listRoute = createRoute({
  method: 'get',
  path: '/activities/{id}/images',
  operationId: 'ActivityImageController_list',
  request: { params: activityParams },
  responses: {
    200: {
      description: 'Activity images',
      content: { 'application/json': { schema: activityImageListResponse } },
    },
  },
  summary: 'List ready images attached to an activity',
  tags: ['activity-images'],
});

const updateRoute = createRoute({
  method: 'patch',
  path: '/activities/{activityId}/images/{imageId}',
  operationId: 'ActivityImageController_update',
  middleware: [jsonBodyMiddleware] as const,
  request: {
    params: imageParams,
    body: { required: true, content: { 'application/json': { schema: activityImageUpdateInput } } },
  },
  responses: {
    200: {
      description: 'Updated activity image',
      content: { 'application/json': { schema: activityImageResponse } },
    },
  },
  tags: ['activity-images'],
});

const deleteRoute = createRoute({
  method: 'delete',
  path: '/activities/{activityId}/images/{imageId}',
  operationId: 'ActivityImageController_delete',
  request: { params: imageParams },
  responses: { 204: { description: '' } },
  tags: ['activity-images'],
});

const fileRoute = createRoute({
  method: 'get',
  path: '/activity-images/{imageId}/{variant}',
  operationId: 'ActivityImageController_file',
  request: { params: fileParams },
  responses: { 200: { description: '' } },
  summary: 'Read an image variant',
  tags: ['activity-images'],
});

export const registerActivityImageRoutes = (
  app: OpenAPIHono<ApiEnv>,
  images: ActivityImageRouteService,
  uploads: UploadReader,
  files: FileReader,
): void => {
  app.openapi(uploadRoute, async (context) => {
    const upload = (await uploads.read(context.req.raw, context.env, 'image')) as ImageUpload | undefined;
    const result = await images.upload(
      context.req.valid('param').id,
      upload?.file,
      upload?.caption,
      context.get('user').id,
    );
    return context.json(activityImageResponse.parse(result), 201);
  });
  app.openapi(listRoute, async (context) => {
    const result = await images.list(context.req.valid('param').id, context.get('user').id);
    return context.json(activityImageListResponse.parse(result), 200);
  });
  app.openapi(updateRoute, async (context) => {
    const { activityId, imageId } = context.req.valid('param');
    const result = await images.update(activityId, imageId, context.req.valid('json'), context.get('user').id);
    return context.json(activityImageResponse.parse(result), 200);
  });
  app.openapi(deleteRoute, async (context) => {
    const { activityId, imageId } = context.req.valid('param');
    if (!(await images.delete(activityId, imageId, context.get('user').id))) {
      throw new NotFoundException('Image does not exist');
    }
    return context.body(null, 204);
  });
  app.openapi(fileRoute, async (context) => {
    const { imageId, variant } = context.req.valid('param');
    if (!['original', 'thumbnail', 'preview'].includes(variant)) {
      throw new NotFoundException('Image variant does not exist');
    }
    const file = await images.getFile(imageId, variant as 'original' | 'thumbnail' | 'preview', context.get('user').id);
    return fileResponse(context.req.raw, files, file.absolutePath, {
      size: file.byte_size,
      missingMessage: 'Image variant does not exist',
      headers: {
        'Content-Type': file.mime_type,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    }) as never;
  });
};
