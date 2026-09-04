import { z } from '@hono/zod-openapi';
import { createZodDto } from 'nestjs-zod';

import { ManualJobName, QueueCommand, QueueName } from 'src/enum';

const QueueNameSchema = z.enum(QueueName).describe('Queue name').meta({ id: 'QueueName' });

const JobCountsSchema = z
  .object({
    active: z.number().int().nonnegative().describe('Jobs currently executing'),
    queued: z.number().int().nonnegative().describe('Jobs waiting, including ones deferred to a future time'),
    deferred: z.number().int().nonnegative().describe('Jobs scheduled to start later and not yet runnable'),
    ready: z.number().int().nonnegative().describe('Jobs runnable right now: the true backlog'),
    failed: z.number().int().nonnegative().describe('Recent failures, including the dead letter backlog'),
    total: z.number().int().nonnegative().describe('All retained jobs, including completed ones'),
  })
  .meta({ id: 'JobCountsDto' });

const QueueStatusSchema = z
  .object({
    paused: z.boolean().describe('True when this worker has stopped consuming the queue'),
  })
  .meta({ id: 'QueueStatusDto' });

const JobHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  activityId: z.string().uuid().nullable(),
  queue: QueueNameSchema,
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped']),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  attempt: z.number().int().positive(),
  error: z.string().nullable(),
});

export const JobHistoryResponseSchema = z.object({
  jobs: z.array(JobHistoryEntrySchema),
  total: z.number().int().nonnegative(),
});

export const JobHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const QueueStatusReportSchema = z.object({
  jobCounts: JobCountsSchema,
  queueStatus: QueueStatusSchema,
});

export const AllJobStatusResponseSchema = z.object(
  Object.fromEntries(Object.values(QueueName).map((queue) => [queue, QueueStatusReportSchema])),
);

export const JobCreateSchema = z.object({
  name: z.enum(ManualJobName).describe('The job to run'),
});

export const QueueCommandSchema = z.object({
  command: z.enum(QueueCommand).describe('Operation to perform on the queue'),
});

export const QueueNameParamSchema = z.object({ name: QueueNameSchema });

export class QueueStatusReportDto extends createZodDto(QueueStatusReportSchema) {}
export class AllJobStatusResponseDto extends createZodDto(AllJobStatusResponseSchema) {}
export class JobHistoryResponseDto extends createZodDto(JobHistoryResponseSchema) {}
export class JobHistoryQueryDto extends createZodDto(JobHistoryQuerySchema) {}
export class JobCreateDto extends createZodDto(JobCreateSchema) {}
export class QueueCommandDto extends createZodDto(QueueCommandSchema) {}
export class QueueNameParamDto extends createZodDto(QueueNameParamSchema) {}
