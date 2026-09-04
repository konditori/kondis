import { sql } from 'kysely';

import { retryDelaySeconds, type BackgroundJobRecord } from 'src/cloudflare/background-job';
import { JobName, JobStatus } from 'src/enum';
import type { KondisDatabase } from 'src/types';
import type { JobItem } from 'src/types/jobs';
import { asErrorMessage } from 'src/utils/misc';

type ClaimedJob = Pick<BackgroundJobRecord, 'id' | 'name' | 'retry_count' | 'retry_limit'> & {
  payload: { name: JobItem['name']; data: never };
};

export type PollingJobHandler = (data: never) => Promise<JobStatus>;
export type PollingJobHandlers = Partial<Record<JobName, PollingJobHandler>>;
export type PollingJobConsumerOptions = {
  pollIntervalMs?: number;
  logger?: Pick<Console, 'error' | 'warn'>;
};

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const claimNextPollingJob = async (db: KondisDatabase): Promise<ClaimedJob | undefined> =>
  db.transaction().execute(async (transaction) => {
    const result = await sql<ClaimedJob>`
      WITH candidate AS (
        SELECT id
        FROM background_job
        WHERE state IN ('created', 'retry') AND start_after <= now()
        ORDER BY priority DESC, created_on
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE background_job AS job
      SET state = 'active', started_on = COALESCE(job.started_on, now())
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.id::text, job.name, job.payload, job.retry_count, job.retry_limit
    `.execute(transaction);
    return result.rows[0];
  });

export class PollingJobConsumer {
  private running = false;
  private loopPromise: Promise<void> | undefined;
  private onJobRun: ((item: JobItem) => Promise<JobStatus>) | undefined;

  constructor(
    private readonly db: KondisDatabase,
    private readonly handlers: PollingJobHandlers,
    private readonly options: PollingJobConsumerOptions = {},
  ) {}

  startWorkers(onJobRun: (item: JobItem) => Promise<JobStatus>): Promise<void> {
    if (this.running) {
      return Promise.resolve();
    }
    this.onJobRun = onJobRun;
    this.running = true;
    this.loopPromise = this.consume();
    return Promise.resolve();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.loopPromise;
    this.loopPromise = undefined;
  }

  async run<T extends JobName>({ name, data }: JobItem & { name: T }): Promise<JobStatus> {
    const handler = this.handlers[name];
    if (!handler) {
      return JobStatus.Skipped;
    }
    return handler(data as never);
  }

  private async consume(): Promise<void> {
    const pollIntervalMs = this.options.pollIntervalMs ?? 1000;
    while (this.running) {
      try {
        const job = await claimNextPollingJob(this.db);
        if (!job) {
          await sleep(pollIntervalMs);
          continue;
        }
        await this.process(job);
      } catch (error) {
        this.options.logger?.error(`Polling job consumer failed: ${asErrorMessage(error)}`);
        await sleep(pollIntervalMs);
      }
    }
  }

  private async process(job: ClaimedJob): Promise<void> {
    const item = job.payload as JobItem;
    try {
      const status = this.onJobRun ? await this.onJobRun(item) : await this.run(item);
      await sql`
        UPDATE background_job
        SET state = 'completed', completed_on = now(), output = ${JSON.stringify({ status })}::jsonb
        WHERE id = ${job.id}::uuid AND state = 'active'
      `.execute(this.db);
    } catch (error) {
      const nextRetry = job.retry_count + 1;
      const exhausted = nextRetry >= job.retry_limit;
      const delaySeconds = retryDelaySeconds(job.retry_count);
      await sql`
        UPDATE background_job
        SET state = ${exhausted ? 'failed' : 'retry'},
            retry_count = ${nextRetry},
            start_after = now() + (${delaySeconds} * interval '1 second'),
            completed_on = ${exhausted ? sql`now()` : sql`NULL`},
            output = ${JSON.stringify({ status: JobStatus.Failed, message: asErrorMessage(error) })}::jsonb
        WHERE id = ${job.id}::uuid AND state = 'active'
      `.execute(this.db);
      this.options.logger?.warn(`Polling job ${job.id} failed: ${asErrorMessage(error)}`);
    }
  }
}
