import { ConsoleLogger, Injectable } from '@nestjs/common';

import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { ActivityRepository, CreateActivityInput, UpdateActivityInput } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { Timestamp } from 'src/schema/decorators';
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

  async listRecent(): Promise<
    {
      id: string;
      uploadId: string;
      sport: string;
      subSport: string | null;
      name: string | null;
      startedAt: string;
      timezoneOffsetMinutes: number | null;
      elapsedTime: number;
      movingTime: number | null;
      distance: number | null;
      elevationGain: number | null;
      elevationLoss: number | null;
      avgSpeed: number | null;
      maxSpeed: number | null;
      avgHr: number | null;
      maxHr: number | null;
      avgCadence: number | null;
      maxCadence: number | null;
      avgPower: number | null;
      maxPower: number | null;
      normalizedPower: number | null;
      calories: number | null;
      createdAt: string;
      updatedAt: string;
    }[]
  > {
    const rows = await this.activityRepository.listRecent();
    return rows.map((row) => this.toActivityDto(row));
  }

  async updateById(
    id: string,
    input: { name?: string | null; sport?: string; subSport?: string | null; startedAt?: Date },
  ): Promise<
    | {
        id: string;
        uploadId: string;
        sport: string;
        subSport: string | null;
        name: string | null;
        startedAt: string;
        timezoneOffsetMinutes: number | null;
        elapsedTime: number;
        movingTime: number | null;
        distance: number | null;
        elevationGain: number | null;
        elevationLoss: number | null;
        avgSpeed: number | null;
        maxSpeed: number | null;
        avgHr: number | null;
        maxHr: number | null;
        avgCadence: number | null;
        maxCadence: number | null;
        avgPower: number | null;
        maxPower: number | null;
        normalizedPower: number | null;
        calories: number | null;
        createdAt: string;
        updatedAt: string;
      }
    | undefined
  > {
    const mapped: UpdateActivityInput = {};

    if (input.name === undefined) {
      // no-op
    } else {
      mapped.name = input.name;
    }

    if (input.sport === undefined) {
      // no-op
    } else {
      mapped.sport = input.sport;
    }

    if (input.subSport === undefined) {
      // no-op
    } else {
      mapped.sub_sport = input.subSport;
    }

    if (input.startedAt === undefined) {
      // no-op
    } else {
      mapped.started_at = input.startedAt;
    }

    const updated = await this.activityRepository.update(id, mapped);
    return updated ? this.toActivityDto(updated) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    const status = await this.handleActivityDelete({ id });
    return status !== JobStatus.Skipped;
  }

  private toActivityDto(activity: {
    id: string;
    upload_id: string;
    sport: string;
    sub_sport: string | null;
    name: string | null;
    started_at: Timestamp;
    timezone_offset_minutes: number | null;
    elapsed_time: number;
    moving_time: number | null;
    distance: number | null;
    elevation_gain: number | null;
    elevation_loss: number | null;
    avg_speed: number | null;
    max_speed: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    avg_cadence: number | null;
    max_cadence: number | null;
    avg_power: number | null;
    max_power: number | null;
    normalized_power: number | null;
    calories: number | null;
    created_at: Timestamp;
    updated_at: Timestamp;
  }) {
    return {
      id: activity.id,
      uploadId: activity.upload_id,
      sport: activity.sport,
      subSport: activity.sub_sport,
      name: activity.name,
      startedAt: this.toIsoString(activity.started_at),
      timezoneOffsetMinutes: activity.timezone_offset_minutes,
      elapsedTime: activity.elapsed_time,
      movingTime: activity.moving_time,
      distance: activity.distance,
      elevationGain: activity.elevation_gain,
      elevationLoss: activity.elevation_loss,
      avgSpeed: activity.avg_speed,
      maxSpeed: activity.max_speed,
      avgHr: activity.avg_hr,
      maxHr: activity.max_hr,
      avgCadence: activity.avg_cadence,
      maxCadence: activity.max_cadence,
      avgPower: activity.avg_power,
      maxPower: activity.max_power,
      normalizedPower: activity.normalized_power,
      calories: activity.calories,
      createdAt: this.toIsoString(activity.created_at),
      updatedAt: this.toIsoString(activity.updated_at),
    };
  }

  private toIsoString(value: Timestamp): string {
    return (value instanceof Date ? value : new Date(value)).toISOString();
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
