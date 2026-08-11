import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import { ActivityType } from 'src/domain/activity-type';
import { BestEffortType, CYCLING_BEST_EFFORTS, RUNNING_BEST_EFFORTS } from 'src/domain/running-best-effort';
import { ActivitySchema } from 'src/dtos/activity.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import {
  ActivityRecord,
  ActivityRepository,
  CreateActivityInput,
  UpdateActivityInput,
} from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { FitMessages, FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { Timestamp } from 'src/schema/decorators';
import { JobItem, JobOf, ParsedActivity } from 'src/types';
import { parseFitMessages } from 'src/utils/fit';

const QUEUE_ALL_PAGE_SIZE = 1000;
export type BestEffortSport = 'run' | 'ride';

const BEST_EFFORT_SPORTS = {
  run: ['run', 'trail_run', 'virtual_run'],
  ride: ['ride', 'gravel_ride', 'mountain_bike_ride', 'virtual_ride'],
} as const satisfies Record<BestEffortSport, readonly ActivityType[]>;
const BEST_EFFORT_DEFINITIONS = new Map(
  [...RUNNING_BEST_EFFORTS, ...CYCLING_BEST_EFFORTS].map((definition) => [definition.type, definition]),
);
// Materialize once at module load; TypeScript's configured lib does not expose Iterator#toArray yet.
// eslint-disable-next-line unicorn/prefer-iterator-to-array
const DETAIL_BEST_EFFORT_DEFINITIONS = [...BEST_EFFORT_DEFINITIONS.values()].filter(
  (definition): definition is typeof definition & { distance: number } => 'distance' in definition,
);

@Injectable()
export class ActivityService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly activityRepository: ActivityRepository,
    private readonly databaseRepository: DatabaseRepository,
    private readonly eventRepository: EventRepository,
    private readonly jobRepository: JobRepository,
    private readonly fitRepository: FitRepository,
    private readonly gpxRepository: GpxRepository,
    private readonly tcxRepository: TcxRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(ActivityService.name);
  }

  @OnJob({ name: JobName.ActivityParse, queue: QueueName.ActivityParsing })
  async handleActivityParse({
    id,
    force,
    activityName,
    activityDescription,
    activitySport,
  }: JobOf<JobName.ActivityParse>): Promise<JobStatus> {
    const upload = await this.uploadRepository.getById(id);
    if (!upload) {
      this.logger.warn(`Skipping parse of upload ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    const existing = await this.activityRepository.getByUploadId(id);
    if (existing) {
      if (!force) {
        await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} });
        return JobStatus.Skipped;
      }

      await this.activityRepository.delete(existing.id);
      await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} });
    }

    try {
      const contents = await this.storageRepository.read(upload.storage_path);
      if (contents.length > UPLOAD_LIMITS.activityFileBytes) {
        throw new Error(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
      }
      const parsed = this.parseActivityFile(upload.storage_path, contents);
      const activityId = await this.activityRepository.create(
        this.toCreateInput(id, parsed, activityName, activityDescription, activitySport),
      );
      await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} });

      await this.uploadRepository.setStatus(id, 'parsed');
      const activity = await this.activityRepository.getByUploadId(id);
      if (!activity) {
        throw new Error(`Activity ${activityId} disappeared immediately after it was created`);
      }
      await this.eventRepository.emit('ActivityCreate', this.toActivityDto(activity));
      this.logger.log(`Parsed upload ${id} into activity ${activityId} (${activitySport ?? parsed.sport})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.uploadRepository.setStatus(id, 'failed', message);
      throw error;
    }

    return JobStatus.Success;
  }

  private parseActivityFile(path: string, contents: Buffer): ParsedActivity {
    const extension = extname(path).toLowerCase();
    let messages: FitMessages;

    switch (extension) {
      case '.fit': {
        messages = this.fitRepository.decode(contents);
        break;
      }
      case '.gpx': {
        messages = this.gpxRepository.decode(contents);
        break;
      }
      case '.tcx': {
        messages = this.tcxRepository.decode(contents);
        break;
      }
      default: {
        throw new Error(`Unsupported activity format: ${extension || 'unknown extension'}`);
      }
    }

    this.assertActivityMessageLimits(messages);
    return parseFitMessages(messages);
  }

  private assertActivityMessageLimits(messages: FitMessages): void {
    const recordCount = messages.recordMesgs?.length ?? 0;
    if (recordCount > UPLOAD_LIMITS.activityRecords) {
      throw new Error(`Activity contains too many records (maximum ${UPLOAD_LIMITS.activityRecords})`);
    }

    const lapCount = messages.lapMesgs?.length ?? 0;
    if (lapCount > UPLOAD_LIMITS.activityLaps) {
      throw new Error(`Activity contains too many laps (maximum ${UPLOAD_LIMITS.activityLaps})`);
    }
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

  @OnJob({ name: JobName.ActivityBestEffortCompute, queue: QueueName.ActivityParsing })
  async handleActivityBestEffortCompute({ id }: JobOf<JobName.ActivityBestEffortCompute>): Promise<JobStatus> {
    const found = await this.activityRepository.recomputeBestEfforts(id);
    if (!found) {
      this.logger.warn(`Skipping best-effort computation for activity ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} });
    this.logger.log(`Computed best efforts for activity ${id}`);
    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityBestEffortRank, queue: QueueName.ActivityParsing })
  async handleActivityBestEffortRank(): Promise<JobStatus> {
    await this.activityRepository.refreshBestEffortRankings();
    this.logger.log('Refreshed best-effort rankings');
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

      await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} }, { transaction: trx });
    });

    this.logger.log(`Deleted activity ${id}`);

    return JobStatus.Success;
  }

  async listRecent({ cursor, limit = 50 }: { cursor?: string; limit?: number }) {
    const rows = await this.activityRepository.listRecentPage({
      limit: limit + 1,
      cursor: cursor ? this.decodeActivityCursor(cursor) : undefined,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const topBestEfforts = await this.topBestEffortsForActivities(page);

    return {
      activities: page.map((row) => ({
        ...this.toActivityDto(row),
        topBestEfforts: topBestEfforts.get(row.id) ?? [],
      })),
      nextCursor: hasMore && last ? this.encodeActivityCursor(last.started_at, last.id) : null,
      total: await this.activityRepository.count(),
    };
  }

  async listBestEfforts(sport: BestEffortSport, type: BestEffortType) {
    const definitions = sport === 'run' ? RUNNING_BEST_EFFORTS : CYCLING_BEST_EFFORTS;
    const selected = definitions.find((effort) => effort.type === type);
    if (!selected) {
      throw new BadRequestException(`${type} is not a supported ${sport} best-effort distance`);
    }
    const sports = [...BEST_EFFORT_SPORTS[sport]];
    const [rows, availableRows] = await Promise.all([
      this.activityRepository.listBestEfforts(type, sports),
      this.activityRepository.listAvailableBestEffortTypes(sports),
    ]);
    const availableTypes = new Set(availableRows.map((row) => row.type));

    return {
      sport,
      type: selected.type,
      label: selected.label,
      valueKind: selected.valueKind,
      higherIsBetter: selected.higherIsBetter,
      distance: 'distance' in selected ? selected.distance : null,
      duration: 'duration' in selected ? selected.duration : null,
      options: definitions
        .filter((definition) => availableTypes.has(definition.type))
        .map((definition) => ({
          type: definition.type,
          label: definition.label,
          valueKind: definition.valueKind,
        })),
      efforts: rows.map((row) => {
        return {
          activityId: row.activity_id,
          activityName: row.name,
          sport: row.sport,
          startedAt: this.toIsoString(row.started_at),
          elapsedTime: row.elapsed_time,
          value: row.value,
          overallRank: row.overall_rank,
          year: row.year,
          yearRank: row.year_rank,
        };
      }),
    };
  }

  async getById(id: string) {
    const row = await this.activityRepository.getDetailById(id);
    if (!row) {
      return;
    }

    const storedEfforts = await this.activityRepository.getBestEfforts(id);
    const trackGeoJson = row.detail_track_geojson ?? row.track_geojson;
    const track = trackGeoJson
      ? (JSON.parse(trackGeoJson) as { type: 'LineString'; coordinates: [number, number][] })
      : null;

    return {
      ...this.toActivityDto(row),
      track,
      bestEfforts: DETAIL_BEST_EFFORT_DEFINITIONS.flatMap((definition) => {
        const effort = storedEfforts.find((candidate) => candidate.type === definition.type);
        return effort
          ? [
              {
                type: definition.type,
                label: definition.label,
                distance: effort.distance,
                elapsedTime: effort.elapsed_time,
                startTime: effort.start_time,
                endTime: effort.end_time,
                year: effort.year,
                yearRank: effort.year_rank,
              },
            ]
          : [];
      }),
    };
  }

  async updateById(
    id: string,
    input: { name?: string | null; description?: string | null; sport?: ActivityType; startedAt?: Date },
  ) {
    const mapped: UpdateActivityInput = {};

    if (input.name === undefined) {
      // no-op
    } else {
      mapped.name = input.name;
    }

    if (input.description === undefined) {
      // no-op
    } else {
      mapped.description = input.description;
    }

    if (input.sport === undefined) {
      // no-op
    } else {
      mapped.sport = input.sport;
    }

    if (input.startedAt === undefined) {
      // no-op
    } else {
      mapped.started_at = input.startedAt;
    }

    const updated = await this.activityRepository.update(id, mapped);
    if (updated && input.sport !== undefined) {
      await this.jobRepository.queue({ name: JobName.ActivityBestEffortCompute, data: { id } });
    } else if (updated && input.startedAt !== undefined) {
      await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} });
    }
    return updated ? this.toActivityDto(updated) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    const status = await this.handleActivityDelete({ id });
    return status !== JobStatus.Skipped;
  }

  private toActivityDto(activity: ActivityRecord) {
    const camelCased = Object.fromEntries(
      Object.entries(activity).map(([key, value]) => [
        key.replaceAll(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase()),
        value,
      ]),
    );

    return ActivitySchema.parse({
      ...camelCased,
      startedAt: this.toIsoString(activity.started_at),
      createdAt: this.toIsoString(activity.created_at),
      updatedAt: this.toIsoString(activity.updated_at),
    });
  }

  private toIsoString(value: Timestamp): string {
    return this.toDate(value).toISOString();
  }

  private toDate(value: Timestamp): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private async topBestEffortsForActivities(activities: ActivityRecord[]) {
    const activityIds = new Set(activities.map(({ id }) => id));
    const result = new Map<string, { type: BestEffortType; label: string; yearRank: number }[]>();
    if (activityIds.size === 0) {
      return result;
    }

    const rows = await this.activityRepository.listTopBestEfforts([...activityIds]);
    for (const row of rows) {
      const definition = BEST_EFFORT_DEFINITIONS.get(row.type);
      if (!definition) {
        continue;
      }
      const efforts = result.get(row.activity_id) ?? [];
      efforts.push({ type: definition.type, label: definition.label, yearRank: row.year_rank });
      result.set(row.activity_id, efforts);
    }

    for (const [activityId, efforts] of result) {
      result.set(activityId, efforts.sort((left, right) => left.yearRank - right.yearRank).slice(0, 3));
    }
    return result;
  }

  private encodeActivityCursor(startedAt: Timestamp, id: string): string {
    return Buffer.from(JSON.stringify([this.toIsoString(startedAt), id])).toString('base64url');
  }

  private decodeActivityCursor(cursor: string): { startedAt: Date; id: string } {
    try {
      const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string') {
        throw new Error('Unexpected cursor value');
      }

      const startedAt = new Date(value[0]);
      if (Number.isNaN(startedAt.getTime()) || value[1].length === 0) {
        throw new Error('Unexpected cursor value');
      }
      return { startedAt, id: value[1] };
    } catch (error) {
      throw new BadRequestException('Invalid activity cursor', { cause: error });
    }
  }

  private toCreateInput(
    uploadId: string,
    parsed: ParsedActivity,
    activityName?: string,
    activityDescription?: string,
    activitySport?: ActivityType,
  ): CreateActivityInput {
    return {
      activity: {
        upload_id: uploadId,
        sport: activitySport ?? parsed.sport,
        name: activityName ?? parsed.name,
        description: activityDescription ?? null,
        started_at: parsed.startedAt,
        timezone_offset_minutes: parsed.timezoneOffset,
      },
      metrics: {
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
