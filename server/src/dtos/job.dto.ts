import { createZodDto } from 'nestjs-zod';
import z from 'zod';

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
export class JobCreateDto extends createZodDto(JobCreateSchema) {}
export class QueueCommandDto extends createZodDto(QueueCommandSchema) {}
export class QueueNameParamDto extends createZodDto(QueueNameParamSchema) {}
