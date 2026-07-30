import { ConsoleLogger, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ParsedActivity } from 'src/domain/activity/parsed-activity';
import { decodeFit } from 'src/domain/fit/fit-decoder';
import { parseFitMessages } from 'src/domain/fit/parse-fit';
import { ActivityRepository, CreateActivityInput } from 'src/repositories/activity.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';

@Injectable()
export class ActivityService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(ActivityService.name);
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
