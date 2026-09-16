import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import type { ApiEnv } from 'src/api/auth';
import { ACTIVITY_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS, VIDEO_FILE_EXTENSIONS } from 'src/config/upload-formats';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { CapabilitiesResponseSchema, type CapabilitiesResponseDto } from 'src/dtos/capabilities.dto';

// Server-side validation stays authoritative; this configuration exists for client-side parsing and UX.
export const buildCapabilities = (): CapabilitiesResponseDto => ({
  uploads: {
    activityExtensions: [...ACTIVITY_FILE_EXTENSIONS],
    imageExtensions: [...IMAGE_FILE_EXTENSIONS],
    videoExtensions: [...VIDEO_FILE_EXTENSIONS],
    limits: {
      activityFileBytes: UPLOAD_LIMITS.activityFileBytes,
      imageFileBytes: UPLOAD_LIMITS.imageFileBytes,
      avatarFileBytes: UPLOAD_LIMITS.avatarFileBytes,
      zipEntries: UPLOAD_LIMITS.zipEntries,
      zipEntryBytes: UPLOAD_LIMITS.zipEntryBytes,
      zipExpandedBytes: UPLOAD_LIMITS.zipExpandedBytes,
      zipCompressionRatio: UPLOAD_LIMITS.zipCompressionRatio,
      manifestBytes: UPLOAD_LIMITS.manifestBytes,
      manifestRows: UPLOAD_LIMITS.manifestRows,
    },
  },
});

const capabilitiesResponse = CapabilitiesResponseSchema.openapi('CapabilitiesDto_Output');

const capabilitiesRoute = createRoute({
  method: 'get',
  path: '/capabilities',
  operationId: 'CapabilitiesController_get',
  parameters: [],
  responses: {
    200: {
      description: 'Upload formats and limits supported by the server',
      content: { 'application/json': { schema: capabilitiesResponse } },
    },
  },
  summary: 'Server capabilities for client-side parsing and UX',
  tags: ['server'],
});

export const registerCapabilitiesRoutes = (app: OpenAPIHono<ApiEnv>): void => {
  app.openapi(capabilitiesRoute, (context) => context.json(buildCapabilities(), 200));
};
