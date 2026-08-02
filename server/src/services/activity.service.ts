import { ConsoleLogger, Injectable, NotFoundException } from '@nestjs/common';

import { OnJob } from 'src/decorators';
import { ParsedActivity } from 'src/domain/activity/parsed-activity';
import { decodeFit } from 'src/domain/fit/fit-decoder';
import { parseFitMessages } from 'src/domain/fit/parse-fit';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { ActivityRepository, CreateActivityInput } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { JobItem, JobOf } from 'src/types';

/**
 * How many upload ids a fan-out job reads and enqueues per round trip.
 *
 * Large enough that a hundred thousand uploads is a few hundred queries, small enough that a
 * single insert never approaches Postgres's bound-parameter limit or holds a long-lived
 * snapshot open.
 */
const QUEUE_ALL_PAGE_SIZE = 1000;

@Injectable()
export class ActivityService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly databaseRepository: DatabaseRepository,
    private readonly jobRepository: JobRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(ActivityService.name);
  }

  /**
   * Turn one stored upload into an activity.
   *
   * Errors are thrown rather than swallowed, so pg-boss retries with backoff and eventually
   * dead-letters. A corrupt FIT file will burn its three attempts, which costs milliseconds
   * and is a fair price for a transient read error getting a second chance.
   */
  @OnJob({ name: JobName.ActivityParse, queue: QueueName.ActivityParsing })
  async handleActivityParse({ id, force }: JobOf<JobName.ActivityParse>): Promise<JobStatus> {
    const upload = await this.uploadRepository.getById(id);
    if (!upload) {
      // Deleted between enqueue and execution. Retrying cannot bring it back.
      this.logger.warn(`Skipping parse of upload ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    const existing = await this.activityRepository.getByUploadId(id);
    if (existing) {
      if (!force) {
        return JobStatus.Skipped;
      }

      // A forced re-parse replaces the activity rather than merging into it, so a change in
      // how streams or laps are derived cannot leave a half-old, half-new row behind.
      await this.activityRepository.delete(existing.id);
    }

    await this.createFromUpload(id);

    return JobStatus.Success;
  }

  /**
   * Enqueue a parse for every upload that needs one.
   *
   * Runs nightly and on demand. Without `force` it only picks up uploads that never produced
   * an activity, which makes it both the retry mechanism for failed imports and the backstop
   * for an enqueue that was somehow lost.
   */
  @OnJob({ name: JobName.ActivityParseQueueAll, queue: QueueName.BackgroundTask })
  async handleActivityParseQueueAll({ force = false }: JobOf<JobName.ActivityParseQueueAll>): Promise<JobStatus> {
    let after: string | undefined;
    let total = 0;

    for (;;) {
      const ids = await this.uploadRepository.getIdsToParse({ force, after, limit: QUEUE_ALL_PAGE_SIZE });
      if (ids.length === 0) {
        break;
      }

      const jobs: JobItem[] = ids.map((id) => ({
        name: JobName.ActivityParse,
        // Marked as backfill so a live upload arriving mid-scan is still served first.
        data: { id, force, source: 'backfill' },
      }));

      await this.jobRepository.queueAll(jobs);

      total += ids.length;
      after = ids.at(-1);
    }

    this.logger.log(`Queued ${total} upload(s) for parsing (force=${force})`);

    return JobStatus.Success;
  }

  /**
   * Delete an activity, the upload it came from, and the file on disk.
   *
   * The row delete and the file-delete job commit together. If the transaction rolls back no
   * file is removed; if the process dies immediately after the commit, the job survives and
   * the file is still cleaned up. Doing the unlink inline would give neither guarantee.
   */
  @OnJob({ name: JobName.ActivityDelete, queue: QueueName.BackgroundTask })
  async handleActivityDelete({ id }: JobOf<JobName.ActivityDelete>): Promise<JobStatus> {
    const activity = await this.activityRepository.getById(id);
    if (!activity) {
      return JobStatus.Skipped;
    }

    const upload = await this.uploadRepository.getById(activity.upload_id);

    await this.databaseRepository.withTransaction(async (trx) => {
      // Cascades to the activity, its streams and its laps.
      await this.uploadRepository.delete(activity.upload_id, trx);

      if (upload) {
        await this.jobRepository.queue(
          { name: JobName.FileDelete, data: { paths: [upload.storage_path] } },
          { transaction: trx },
        );
      }
    });

    this.logger.log(`Deleted activity ${id}`);

    return JobStatus.Success;
  }

  async createFromUpload(uploadId: string): Promise<string> {
    const upload = await this.uploadRepository.getById(uploadId);
    if (!upload) {
      throw new NotFoundException(`Upload ${uploadId} not found`);
    }

    const existing = await this.activityRepository.getByUploadId(uploadId);
    if (existing) {
      this.logger.log(`Upload ${uploadId} already parsed into activity ${existing.id}`);
      return existing.id;
    }

    try {
      const contents = await this.storageRepository.read(upload.storage_path);
      const parsed = parseFitMessages(decodeFit(contents));
      const activityId = await this.activityRepository.create(this.toCreateInput(uploadId, parsed));

      await this.uploadRepository.setStatus(uploadId, 'parsed');
      this.logger.log(`Parsed upload ${uploadId} into activity ${activityId} (${parsed.sport})`);

      return activityId;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.uploadRepository.setStatus(uploadId, 'failed', message);
      throw error;
    }
  }

  private toCreateInput(uploadId: string, parsed: ParsedActivity): CreateActivityInput {
    return {
      activity: {
        upload_id: uploadId,
        sport: parsed.sport,
        sub_sport: parsed.subSport,
        name: parsed.name,
        started_at: parsed.startedAt,
        timezone_offset_minutes: parsed.timezoneOffsetMinutes,
        elapsed_time_s: parsed.elapsedTimeS,
        moving_time_s: parsed.movingTimeS,
        distance_m: parsed.distanceM,
        elevation_gain_m: parsed.elevationGainM,
        elevation_loss_m: parsed.elevationLossM,
        avg_speed_mps: parsed.avgSpeedMps,
        max_speed_mps: parsed.maxSpeedMps,
        avg_hr: parsed.avgHr,
        max_hr: parsed.maxHr,
        avg_cadence: parsed.avgCadence,
        max_cadence: parsed.maxCadence,
        avg_power: parsed.avgPower,
        max_power: parsed.maxPower,
        normalized_power: parsed.normalizedPower,
        calories: parsed.calories,
      },
      streams: parsed.streams.map((stream) => ({ type: stream.type, data: stream.data })),
      laps: parsed.laps.map((lap) => ({
        lap_index: lap.index,
        started_at: lap.startedAt,
        elapsed_time_s: lap.elapsedTimeS,
        moving_time_s: lap.movingTimeS,
        distance_m: lap.distanceM,
        avg_hr: lap.avgHr,
        max_hr: lap.maxHr,
        avg_power: lap.avgPower,
        avg_speed_mps: lap.avgSpeedMps,
      })),
    };
  }
}
