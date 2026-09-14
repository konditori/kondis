import { sql } from 'kysely';

import { nextJobFailure, type BackgroundJobRecord } from 'src/cloudflare/background-job';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { CLOUD_JOB_CONSUMER, JOB_EXPIRE_SECONDS, JOB_RETENTION_SECONDS } from 'src/jobs/job-semantics';
import {
  JOB_DELIVERY_MESSAGE_VERSION,
  type JobDeliveryBatch,
  type JobDeliveryEnvelope,
} from 'src/ports/job-transport.port';
import type { RealtimePort } from 'src/ports/realtime.port';
import { SessionRepository } from 'src/repositories/session.repository';
import type { ActivityService } from 'src/services/activity.service';
import type { WorkerUploadService } from 'src/services/worker-upload.service';
import { ImportProgressStore } from 'src/state/import-progress.store';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';
import { asErrorMessage } from 'src/utils/misc';

const UUID_PATTERN = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const MAX_STORED_ERROR_LENGTH = 4096;
const unavailableWorkerStorage = () => Promise.reject(new Error('STORAGE_BUCKET is required for activity processing'));

export type CloudJobHandler = (data: never) => Promise<JobStatus>;
export type CloudJobHandlers = Partial<Record<JobName, CloudJobHandler>>;

const parseMessage = (body: unknown): JobDeliveryEnvelope | undefined => {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const value = body as Record<string, unknown>;
  if (
    value.version !== JOB_DELIVERY_MESSAGE_VERSION ||
    typeof value.jobId !== 'string' ||
    !UUID_PATTERN.test(value.jobId) ||
    typeof value.queue !== 'string' ||
    !Object.values(QueueName).includes(value.queue as QueueName)
  ) {
    return undefined;
  }
  return value as JobDeliveryEnvelope;
};

const storedError = (error: unknown): string => asErrorMessage(error).slice(0, MAX_STORED_ERROR_LENGTH);

const claimJob = async (
  db: KondisDatabase,
  jobId: string,
  queue: QueueName,
): Promise<BackgroundJobRecord | undefined> => {
  const result = await sql<BackgroundJobRecord>`
    UPDATE background_job AS job
    SET state = 'active',
        started_on = now(),
        completed_on = NULL,
        delete_after = NULL,
        lease_id = gen_random_uuid(),
        lease_expires_at = now() + (${JOB_EXPIRE_SECONDS} * interval '1 second')
    WHERE job.id = ${jobId}::uuid
      AND job.queue = ${queue}
      AND job.consumer = 'worker'
      AND job.state IN ('created', 'retry')
      AND job.start_after <= now()
    RETURNING id::text, queue, name, payload, state, retry_count, retry_limit, consumer, lease_id::text
  `.execute(db);
  return result.rows[0];
};

const releaseUnclaimedMessage = async (db: KondisDatabase, jobId: string, queue: QueueName): Promise<void> => {
  await sql`
    UPDATE background_job
    SET published_on = NULL, dispatch_token = NULL
    WHERE id = ${jobId}::uuid
      AND queue = ${queue}
      AND consumer = 'worker'
      AND state IN ('created', 'retry')
  `.execute(db);
};

const completeJob = async (db: KondisDatabase, row: BackgroundJobRecord, status: JobStatus): Promise<boolean> => {
  const result = await sql<{ id: string }>`
    UPDATE background_job
    SET state = 'completed',
        completed_on = now(),
        output = ${JSON.stringify({ status })}::jsonb,
        delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
        lease_id = NULL,
        lease_expires_at = NULL,
        dispatch_token = NULL
    WHERE id = ${row.id}::uuid AND state = 'active' AND lease_id = ${row.lease_id}::uuid
    RETURNING id::text
  `.execute(db);
  return result.rows.length === 1;
};

const failJob = async (db: KondisDatabase, row: BackgroundJobRecord, error: unknown): Promise<boolean> => {
  const transition = nextJobFailure(row.retry_count, row.retry_limit);
  const state = transition.exhausted ? 'failed' : 'retry';
  const result = await sql<{ id: string }>`
    UPDATE background_job
    SET state = ${state},
        retry_count = ${transition.retryCount},
        start_after = now() + (${transition.delaySeconds} * interval '1 second'),
        completed_on = ${transition.exhausted ? sql`now()` : sql`NULL`},
        published_on = ${transition.exhausted ? sql`published_on` : sql`NULL`},
        delete_after = ${
          transition.exhausted ? sql`now() + (${JOB_RETENTION_SECONDS} * interval '1 second')` : sql`NULL`
        },
        lease_id = NULL,
        lease_expires_at = NULL,
        dispatch_token = NULL,
        output = ${JSON.stringify({ status: JobStatus.Failed, message: storedError(error) })}::jsonb
    WHERE id = ${row.id}::uuid AND state = 'active' AND lease_id = ${row.lease_id}::uuid
    RETURNING id::text
  `.execute(db);
  if (result.rows.length === 1 && transition.exhausted) {
    await failImportItemForExhaustedJob(db, row, error);
  }
  return result.rows.length === 1;
};

const failPermanently = async (db: KondisDatabase, row: BackgroundJobRecord, error: unknown): Promise<void> => {
  await sql`
    UPDATE background_job
    SET state = 'failed',
        completed_on = now(),
        delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
        lease_id = NULL,
        lease_expires_at = NULL,
        dispatch_token = NULL,
        output = ${JSON.stringify({ status: JobStatus.Failed, message: storedError(error) })}::jsonb
    WHERE id = ${row.id}::uuid AND state = 'active' AND lease_id = ${row.lease_id}::uuid
  `.execute(db);
  await failImportItemForExhaustedJob(db, row, error);
};

const failImportItemForExhaustedJob = async (
  db: KondisDatabase,
  row: BackgroundJobRecord,
  error: unknown,
): Promise<void> => {
  await failImportItemForPayload(db, row.payload, storedError(error));
};

const failImportItemForPayload = async (
  db: KondisDatabase,
  payload: { data?: object } | undefined,
  error: string,
): Promise<void> => {
  const data = payload?.data as { takeoutImportId?: unknown; takeoutItemKey?: unknown } | undefined;
  if (typeof data?.takeoutImportId !== 'string' || typeof data.takeoutItemKey !== 'string') {
    return;
  }
  await new ImportProgressStore(db).failJobItem(data.takeoutImportId, data.takeoutItemKey, error);
};

export const handleQueueBatch = async (
  batch: JobDeliveryBatch,
  db: KondisDatabase,
  handlers: CloudJobHandlers,
  expectedQueue: QueueName,
  realtime?: RealtimePort,
): Promise<void> => {
  let changed = false;
  for (const delivery of batch.deliveries) {
    const body = parseMessage(delivery.payload);
    if (!body) {
      console.error('Discarding a malformed job delivery');
      delivery.acknowledge();
      continue;
    }
    if (body.queue !== expectedQueue) {
      console.error(`Queue message for ${body.queue} was delivered to ${expectedQueue}`);
      delivery.retry();
      continue;
    }

    const row = await claimJob(db, body.jobId, expectedQueue);
    if (!row) {
      // A duplicate or early delivery is safe to discard. Clearing the outbox
      // marker lets the dispatcher publish the still-pending job again.
      await releaseUnclaimedMessage(db, body.jobId, expectedQueue);
      delivery.acknowledge();
      continue;
    }
    changed = true;

    const handler = handlers[row.name as JobName];
    if (!handler) {
      await failPermanently(db, row, new Error(`No Worker handler registered for job ${row.name}`));
      delivery.acknowledge();
      continue;
    }

    let status: JobStatus;
    try {
      const payload = row.payload as { name: JobItem['name']; data: never };
      status = await handler(payload.data);
    } catch (error) {
      await failJob(db, row, error);
      // Domain retries are persisted in the transactional outbox. Acknowledging
      // this delivery avoids racing a Queue retry against the dispatcher.
      delivery.acknowledge();
      continue;
    }

    await completeJob(db, row, status);
    delivery.acknowledge();
  }
  // One update per Queue batch prevents state-change storms in admin dashboards.
  if (changed) {
    await realtime?.emit('JobUpdated');
  }
};

export const handleDeadLetterBatch = async (
  batch: JobDeliveryBatch,
  db: KondisDatabase,
  expectedQueue: QueueName,
  realtime?: RealtimePort,
): Promise<void> => {
  let changed = false;
  for (const delivery of batch.deliveries) {
    const body = parseMessage(delivery.payload);
    if (!body || body.queue !== expectedQueue) {
      console.error('Discarding a malformed or misrouted dead-letter message');
      delivery.acknowledge();
      continue;
    }
    const result = await sql<{ payload: { data?: object } }>`
      UPDATE background_job
      SET state = 'dead',
          completed_on = COALESCE(completed_on, now()),
          delete_after = now() + (${JOB_RETENTION_SECONDS} * interval '1 second'),
          lease_id = NULL,
          lease_expires_at = NULL,
          dispatch_token = NULL,
          output = COALESCE(output, ${JSON.stringify({ message: 'Queue delivery exhausted' })}::jsonb)
      WHERE id = ${body.jobId}::uuid
        AND queue = ${expectedQueue}
        AND consumer = 'worker'
        AND state IN ('created', 'active', 'retry')
      RETURNING payload
    `.execute(db);
    for (const row of result.rows) {
      await failImportItemForPayload(db, row.payload, 'Queue delivery exhausted');
    }
    changed = true;
    delivery.acknowledge();
  }
  if (changed) {
    await realtime?.emit('JobUpdated');
  }
};

type PortableWorkerServices = {
  activityService?: Pick<
    ActivityService,
    | 'handleActivityBestEffortCompute'
    | 'handleActivityBestEffortRank'
    | 'handleActivityMetricCompute'
    | 'handleActivityManualCreate'
    | 'handleActivityParse'
    | 'handleActivityRouteMatchCompute'
  >;
  uploadService?: Pick<WorkerUploadService, 'handleActivityUpload'>;
};

export const createPortableWorkerHandlers = (
  db: KondisDatabase,
  services: PortableWorkerServices = {},
): CloudJobHandlers => {
  const credentials = new SessionRepository(db);
  const handlers: CloudJobHandlers = {
    [JobName.AuthCredentialCleanup]: async () => {
      await credentials.deleteExpired();
      return JobStatus.Success;
    },
    [JobName.ActivityUpload]:
      services.uploadService?.handleActivityUpload.bind(services.uploadService) ?? unavailableWorkerStorage,
    [JobName.ActivityParse]:
      services.activityService?.handleActivityParse.bind(services.activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityMetricCompute]:
      services.activityService?.handleActivityMetricCompute.bind(services.activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityBestEffortCompute]:
      services.activityService?.handleActivityBestEffortCompute.bind(services.activityService) ??
      unavailableWorkerStorage,
    [JobName.ActivityBestEffortRank]:
      services.activityService?.handleActivityBestEffortRank.bind(services.activityService) ?? unavailableWorkerStorage,
    [JobName.ActivityRouteMatchCompute]:
      services.activityService?.handleActivityRouteMatchCompute.bind(services.activityService) ??
      unavailableWorkerStorage,
    [JobName.ActivityManualCreate]:
      services.activityService?.handleActivityManualCreate.bind(services.activityService) ?? unavailableWorkerStorage,
  };

  for (const jobName of Object.values(JobName)) {
    const registered = Boolean(handlers[jobName]);
    if (registered !== (CLOUD_JOB_CONSUMER[jobName] === 'worker')) {
      throw new Error(`Worker handler ownership is inconsistent for JobName.${jobName}`);
    }
  }
  return handlers;
};
