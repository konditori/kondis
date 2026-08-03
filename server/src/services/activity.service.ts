import { ConsoleLogger, Injectable } from '@nestjs/common';
import { buildStreams, FitParseError, mapLap, toName } from 'src/utils/fit-parser';

import { OnJob } from 'src/decorators';
import { ElevationChange, ElevationOptions, ParsedActivity } from 'src/dtos/activity.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { ActivityRepository, CreateActivityInput } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { decodeFit, toDate } from 'src/utils/fit-parser';
import { FitMessages, JobItem, JobOf, StreamType } from 'src/types';
import { inferSampleIntervalS, int, lastFinite, max, mean, num, rollingAverage, roundOrNull } from 'src/utils/math';
  
const QUEUE_ALL_PAGE_SIZE = 1000;
const NORMALIZED_POWER_WINDOW_S = 30;


export const parseFitMessages = (messages: FitMessages): ParsedActivity => {
  const session = messages.sessionMesgs?.[0];
  const records = messages.recordMesgs ?? [];

  const startedAt = toDate(session?.startTime) ?? toDate(records[0]?.timestamp);
  if (startedAt === null) {
    throw new FitParseError('FIT file contains no session start time and no timestamped records');
  }

  const streams = buildStreams(records, startedAt);
  const streamData = (type: StreamType): number[] => streams.find((stream) => stream.type === type)?.data ?? [];

  const time = streamData('time');
  const altitude = streamData('altitude');
  const speed = streamData('speed');
  const power = streamData('power');
  const heartrate = streamData('heartrate');
  const cadence = streamData('cadence');
  const distance = streamData('distance');

  const sampleIntervalS = inferSampleIntervalS(time);
  const elevation = computeElevationChange(altitude, { sampleIntervalS });
  const finalTime = lastFinite(time);

  const elapsedTimeS = int(session?.totalElapsedTime) ?? (finalTime === undefined ? 0 : Math.round(finalTime));
  const movingTimeS = int(session?.totalTimerTime) ?? computeMovingTimeS(speed, time);
  const distanceM = num(session?.totalDistance) ?? lastFinite(distance) ?? null;

  // Older devices record neither an average speed nor a speed stream, but distance and time
  // are nearly always present
  const derivedAvgSpeedMps =
    distanceM !== null && movingTimeS !== null && movingTimeS > 0 ? distanceM / movingTimeS : null;

  // If there is a session summary, use that. Otherwise derive this data from the streams.
  return {
    sport: toName(session?.sport) ?? 'unknown',
    subSport: toName(session?.subSport),
    name: null,
    startedAt,
    timezoneOffsetMinutes: null,
    elapsedTimeS,
    movingTimeS,
    distanceM,
    elevationGainM: num(session?.totalAscent) ?? (altitude.length > 0 ? elevation.gainM : null),
    elevationLossM: num(session?.totalDescent) ?? (altitude.length > 0 ? elevation.lossM : null),
    avgSpeedMps: num(session?.enhancedAvgSpeed ?? session?.avgSpeed) ?? mean(speed) ?? derivedAvgSpeedMps,
    maxSpeedMps: num(session?.enhancedMaxSpeed ?? session?.maxSpeed) ?? max(speed),
    avgHr: int(session?.avgHeartRate) ?? roundOrNull(mean(heartrate)),
    maxHr: int(session?.maxHeartRate) ?? roundOrNull(max(heartrate)),
    avgCadence: int(session?.avgCadence) ?? roundOrNull(mean(cadence)),
    maxCadence: int(session?.maxCadence) ?? roundOrNull(max(cadence)),
    avgPower: int(session?.avgPower) ?? roundOrNull(mean(power)),
    maxPower: int(session?.maxPower) ?? roundOrNull(max(power)),
    normalizedPower: int(session?.normalizedPower) ?? computeNormalizedPower(power, sampleIntervalS),
    calories: int(session?.totalCalories),
    streams,
    laps: (messages.lapMesgs ?? []).map((lap, index) => mapLap(lap, index)),
  };
};

 const computeMovingTimeS = (speed: number[], time: number[], thresholdMps = 0.5): number | null => {
  if (speed.length === 0) {
    return null;
  }

  let movingS = 0;
  for (let index = 1; index < speed.length; index++) {
    if (!Number.isFinite(speed[index]) || speed[index] < thresholdMps) {
      continue;
    }

    const delta = time.length > index ? time[index] - time[index - 1] : 1;
    if (Number.isFinite(delta) && delta > 0) {
      movingS += delta;
    }
  }

  return Math.round(movingS);
};


const ELEVATION_SMOOTHING_WINDOW_S = 30;
const ELEVATION_THRESHOLD_M = 3;

export const computeElevationChange = (altitude: number[], options: ElevationOptions = {}): ElevationChange => {
  const { thresholdM = ELEVATION_THRESHOLD_M, sampleIntervalS = 1 } = options;

  // Non-finite samples are removed *before* smoothing. rollingAverage treats them as zero,
  // which would otherwise read as an instantaneous drop to sea level.
  const usable = altitude.filter((value) => Number.isFinite(value));
  if (usable.length === 0) {
    return { gainM: 0, lossM: 0 };
  }

  const windowSize = Math.max(1, Math.round(ELEVATION_SMOOTHING_WINDOW_S / Math.max(sampleIntervalS, 1)));
  const smoothed = rollingAverage(usable, windowSize);

  let gainM = 0;
  let lossM = 0;
  let reference = smoothed[0];

  for (const value of smoothed) {
    const delta = value - reference;
    if (Math.abs(delta) < thresholdM) {
      continue;
    }

    if (delta > 0) {
      gainM += delta;
    } else {
      lossM -= delta;
    }
    reference = value;
  }

  return { gainM, lossM };
};


const computeNormalizedPower = (power: number[], sampleIntervalS = 1): number | null => {
  if (power.length === 0 || sampleIntervalS <= 0) {
    return null;
  }

  const windowSize = Math.max(1, Math.round(NORMALIZED_POWER_WINDOW_S / sampleIntervalS));
  const smoothed = rollingAverage(power, windowSize);
  if (smoothed.length === 0) {
    return null;
  }

  let total = 0;
  for (const value of smoothed) {
    total += value ** 4;
  }

  return Math.round((total / smoothed.length) ** 0.25);
};


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
      const parsed = parseFitMessages(decodeFit(contents));
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
