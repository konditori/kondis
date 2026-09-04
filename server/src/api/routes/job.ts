import { createRoute, type OpenAPIHono } from '@hono/zod-openapi';

import { requireAdmin, type ApiEnv } from 'src/api/auth';
import { jsonBodyMiddleware } from 'src/api/validation';
import {
  AllJobStatusResponseSchema,
  JobCreateSchema,
  JobHistoryQuerySchema,
  JobHistoryResponseSchema,
  QueueCommandSchema,
  QueueNameParamSchema,
  QueueStatusReportSchema,
} from 'src/dtos/job.dto';
import type { JobService } from 'src/services/job.service';

export type JobRouteService = Pick<JobService, 'create' | 'getAllJobStatus' | 'getJobHistory' | 'handleCommand'>;

const allStatusResponse = AllJobStatusResponseSchema.openapi('AllJobStatusResponseDto_Output');
const historyResponse = JobHistoryResponseSchema.openapi('JobHistoryResponseDto_Output');
const queueStatusResponse = QueueStatusReportSchema.openapi('QueueStatusReportDto_Output');
const createInput = JobCreateSchema.openapi('JobCreateDto');
const commandInput = QueueCommandSchema.openapi('QueueCommandDto');

const statusRoute = createRoute({
  method: 'get',
  path: '/jobs',
  operationId: 'JobController_getAllJobStatus',
  middleware: [requireAdmin] as const,
  parameters: [],
  responses: {
    200: {
      description: 'Current counts and status for every queue',
      content: { 'application/json': { schema: allStatusResponse } },
    },
  },
  summary: 'Queue depths and worker status',
  tags: ['jobs'],
});
const createJobRoute = createRoute({
  method: 'post',
  path: '/jobs',
  description:
    'Most work is queued automatically. This triggers the handful of jobs that are useful to run on demand, such as re-parsing uploads that previously failed.',
  operationId: 'JobController_createJob',
  middleware: [requireAdmin, jsonBodyMiddleware] as const,
  parameters: [],
  request: { body: { required: true, content: { 'application/json': { schema: createInput } } } },
  responses: { 204: { description: '' } },
  summary: 'Run a job by hand',
  tags: ['jobs'],
});
const historyRoute = createRoute({
  method: 'get',
  path: '/jobs/history',
  operationId: 'JobController_getJobHistory',
  middleware: [requireAdmin] as const,
  request: { query: JobHistoryQuerySchema },
  responses: {
    200: {
      description: 'Recently queued and executed jobs',
      content: { 'application/json': { schema: historyResponse } },
    },
  },
  summary: 'Recent job execution history',
  tags: ['jobs'],
});
const commandRoute = createRoute({
  method: 'put',
  path: '/jobs/{name}',
  description:
    'Pause or resume consumption, discard queued jobs, or clear the failed and dead-lettered backlog. Pausing affects only the worker serving the request.',
  operationId: 'JobController_runQueueCommand',
  middleware: [requireAdmin, jsonBodyMiddleware] as const,
  request: {
    params: QueueNameParamSchema,
    body: { required: true, content: { 'application/json': { schema: commandInput } } },
  },
  responses: {
    200: {
      description: 'Counts and status after the command',
      content: { 'application/json': { schema: queueStatusResponse } },
    },
  },
  summary: 'Control a queue',
  tags: ['jobs'],
});

export const registerJobRoutes = (app: OpenAPIHono<ApiEnv>, service: JobRouteService): void => {
  app.openapi(statusRoute, async (context) => {
    return context.json(allStatusResponse.parse(await service.getAllJobStatus()), 200);
  });
  app.openapi(createJobRoute, async (context) => {
    await service.create(context.req.valid('json').name);
    return context.body(null, 204);
  });
  app.openapi(historyRoute, async (context) => {
    const { limit, offset } = context.req.valid('query');
    return context.json(historyResponse.parse(await service.getJobHistory(limit, offset)), 200);
  });
  app.openapi(commandRoute, async (context) => {
    return context.json(
      queueStatusResponse.parse(
        await service.handleCommand(context.req.valid('param').name, context.req.valid('json').command),
      ),
      200,
    );
  });
};
