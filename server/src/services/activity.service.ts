import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import {
  ActivityType,
  supportsCyclingBestEfforts,
  supportsDistanceBestEfforts,
  supportsRunningBestEfforts,
  usesActivityHeatmap,
} from 'src/domain/activity-type';
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
        return JobStatus.Skipped;
      }

      await this.activityRepository.delete(existing.id);
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

  async listRecent({ cursor, limit = 50 }: { cursor?: string; limit?: number }) {
    const rows = await this.activityRepository.listRecentPage({
      limit: limit + 1,
      cursor: cursor ? this.decodeActivityCursor(cursor) : undefined,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      activities: page.map((row) => this.toActivityDto(row)),
      nextCursor: hasMore && last ? this.encodeActivityCursor(last.started_at, last.id) : null,
      total: await this.activityRepository.count(),
    };
  }

  async listBestEfforts(sport: BestEffortSport, type: BestEffortType) {
    // Populate analysis rows for activities imported before best efforts were persisted.
    await this.ensureBestEffortsPopulated();

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
    const compareRows = (left: (typeof rows)[number], right: (typeof rows)[number]): number => {
      const valueComparison = selected.higherIsBetter ? right.value - left.value : left.value - right.value;
      return valueComparison || left.activity_id.localeCompare(right.activity_id);
    };
    const overallRanks = new Map([...rows].sort(compareRows).map((row, index) => [row.activity_id, index + 1]));
    const rowsByYear = Object.groupBy(rows, (row) => this.activityYear(row));
    const yearRanks = new Map<string, number>();
    for (const yearRows of Object.values(rowsByYear)) {
      const rankedRows = [...(yearRows ?? [])].sort(compareRows);
      for (const [index, row] of rankedRows.entries()) {
        yearRanks.set(row.activity_id, index + 1);
      }
    }

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
        const year = this.activityYear(row);
        return {
          activityId: row.activity_id,
          activityName: row.name,
          sport: row.sport,
          startedAt: this.toIsoString(row.started_at),
          elapsedTime: row.elapsed_time,
          value: row.value,
          overallRank: overallRanks.get(row.activity_id)!,
          year,
          yearRank: yearRanks.get(row.activity_id)!,
        };
      }),
    };
  }

  async getById(id: string) {
    const row = await this.activityRepository.getById(id);
    if (!row) {
      return;
    }

    // Older activities predate persisted analysis rows. Fill those without
    // reparsing the upload, which would discard user-edited metadata.
    await this.ensureBestEffortsPopulated();
    const storedEfforts = await this.activityRepository.getBestEfforts(id);
    const effortSport = supportsRunningBestEfforts(row.sport)
      ? 'run'
      : supportsCyclingBestEfforts(row.sport)
        ? 'ride'
        : null;
    const effortDefinitions =
      effortSport === 'run'
        ? RUNNING_BEST_EFFORTS
        : effortSport === 'ride'
          ? CYCLING_BEST_EFFORTS.filter(
              (effort): effort is (typeof CYCLING_BEST_EFFORTS)[number] & { distance: number } => 'distance' in effort,
            )
          : [];
    const activityYear = this.activityYear(row);
    const rankedEfforts = effortSport
      ? await Promise.all(
          effortDefinitions.map(async (definition) => {
            const effort = storedEfforts.find((candidate) => candidate.type === definition.type);
            if (!effort) {
              return null;
            }

            const peers = await this.activityRepository.listBestEfforts(definition.type, [
              ...BEST_EFFORT_SPORTS[effortSport],
            ]);
            const rankedPeers = peers
              .filter((candidate) => this.activityYear(candidate) === activityYear)
              .sort((left, right) => {
                const valueComparison = definition.higherIsBetter ? right.value - left.value : left.value - right.value;
                return valueComparison || left.activity_id.localeCompare(right.activity_id);
              });

            return {
              definition,
              effort,
              yearRank: rankedPeers.findIndex((candidate) => candidate.activity_id === id) + 1,
            };
          }),
        )
      : [];
    const simplifiedTrack = row.track_geojson
      ? (JSON.parse(row.track_geojson) as { type: 'LineString'; coordinates: [number, number][] })
      : null;
    const heatmapCoordinates = usesActivityHeatmap(row.sport)
      ? await this.activityRepository.getTrackCoordinates(id)
      : [];

    return {
      ...this.toActivityDto(row),
      track:
        heatmapCoordinates.length >= 2
          ? { type: 'LineString' as const, coordinates: heatmapCoordinates }
          : simplifiedTrack,
      bestEfforts: rankedEfforts.flatMap((rankedEffort) => {
        return rankedEffort
          ? [
              {
                type: rankedEffort.definition.type,
                label: rankedEffort.definition.label,
                distance: rankedEffort.effort.distance,
                elapsedTime: rankedEffort.effort.elapsed_time,
                startTime: rankedEffort.effort.start_time,
                endTime: rankedEffort.effort.end_time,
                year: activityYear,
                yearRank: rankedEffort.yearRank,
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

  private activityYear(activity: { started_at: Timestamp; timezone_offset_minutes: number | null }): number {
    const offset = activity.timezone_offset_minutes ?? 0;
    return new Date(this.toDate(activity.started_at).getTime() + offset * 60_000).getUTCFullYear();
  }

  private async ensureBestEffortsPopulated(): Promise<void> {
    const activities = await this.activityRepository.listActivitiesMissingBestEfforts();
    for (const activity of activities) {
      if (supportsDistanceBestEfforts(activity.sport)) {
        await this.activityRepository.ensureBestEfforts(activity.id, activity.sport);
      }
    }
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
