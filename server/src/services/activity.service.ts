import { ConsoleLogger, Injectable } from '@nestjs/common';

import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { ActivityRepository, CreateActivityInput } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { JobItem, JobOf, ParsedActivity } from 'src/types';
import { parseFitMessages } from 'src/utils/fit';

const QUEUE_ALL_PAGE_SIZE = 1000;

@Injectable()
export class ActivityService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly databaseRepository: DatabaseRepository,
    private readonly jobRepository: JobRepository,
    private readonly fitRepository: FitRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(ActivityService.name);
  }

  @OnJob({ name: JobName.ActivityParse, queue: QueueName.ActivityParsing })
  async handleActivityParse({ id, force }: JobOf<JobName.ActivityParse>): Promise<JobStatus> {
    const upload = await this.uploadRepository.getById(id);
    if (!upload) {
      this.logger.warn(`Skipping parse of upload ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    const existing = await this.activityRepository.getByUploadId(id);
    if (existing) {
      if (!force) {
        return JobStatus.Skipped;
      }

      await this.activityRepository.delete(existing.id);
    }

    try {
      const contents = await this.storageRepository.read(upload.storage_path);
      const parsed = parseFitMessages(this.fitRepository.decode(contents));
      const activityId = await this.activityRepository.create(this.toCreateInput(id, parsed));

      await this.uploadRepository.setStatus(id, 'parsed');
      this.logger.log(`Parsed upload ${id} into activity ${activityId} (${parsed.sport})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.uploadRepository.setStatus(id, 'failed', message);
      throw error;
    }

    return JobStatus.Success;
  }

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
        data: { id, force },
      }));

      await this.jobRepository.queueAll(jobs);

      total += ids.length;
      after = ids.at(-1);
    }

    this.logger.log(`Queued ${total} upload(s) for parsing (force=${force})`);

    return JobStatus.Success;
  }

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

  private toCreateInput(uploadId: string, parsed: ParsedActivity): CreateActivityInput {
    return {
      activity: {
        upload_id: uploadId,
        sport: parsed.sport,
        sub_sport: parsed.subSport,
        name: parsed.name,
        started_at: parsed.startedAt,
        timezone_offset_minutes: parsed.timezoneOffset,
        elapsed_time: parsed.elapsedTime,
        moving_time: parsed.movingTime,
        distance: parsed.distance,
        elevation_gain: parsed.elevationGain,
        elevation_loss: parsed.elevationLoss,
        avg_speed: parsed.avgSpeed,
        max_speed: parsed.maxSpeed,
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
        elapsed_time: lap.elapsedTimeS,
        moving_time: lap.movingTimeS,
        distance: lap.distanceM,
        avg_hr: lap.avgHr,
        max_hr: lap.maxHr,
        avg_power: lap.avgPower,
        avg_speed_mps: lap.avgSpeedMps,
      })),
    };
  }
}
