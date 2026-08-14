import { BadRequestException, ConsoleLogger, Injectable, Optional } from '@nestjs/common';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import { ActivitySchema } from 'src/dtos/activity.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import {
  ActivityListRecord,
  ActivityMetrics,
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
import { ImportProgressStore } from 'src/state/import-progress.store';
import {
  ACTIVITY_TYPES,
  ActivityType,
  BestEffortGroup,
  BestEffortType,
  CYCLING_BEST_EFFORTS,
  JobItem,
  JobOf,
  ParsedActivity,
  ParsedActivityStructure,
  RUNNING_BEST_EFFORTS,
} from 'src/types';
import { buildActivityAnalysis } from 'src/utils/activity-details';
import { parseFitMessages, parseFitStructure } from 'src/utils/fit';

const QUEUE_ALL_PAGE_SIZE = 1000;
export type BestEffortSport = 'run' | 'ride';

const BEST_EFFORT_SPORTS = {
  run: ACTIVITY_TYPES.filter(({ bestEffortGroup }) => bestEffortGroup === BestEffortGroup.Run).map(({ type }) => type),
  ride: ACTIVITY_TYPES.filter(({ bestEffortGroup }) => bestEffortGroup === BestEffortGroup.Ride).map(
    ({ type }) => type,
  ),
} satisfies Record<BestEffortSport, readonly ActivityType[]>;
const CYCLING_ANALYSIS_SPORTS: ReadonlySet<ActivityType> = new Set([
  ...BEST_EFFORT_SPORTS.ride,
  'e_bike_ride',
  'e_mountain_bike_ride',
]);
const BEST_EFFORT_DEFINITIONS = new Map(
  [...RUNNING_BEST_EFFORTS, ...CYCLING_BEST_EFFORTS].map((definition) => [definition.type, definition]),
);
// Materialize once at module load; TypeScript's configured lib does not expose Iterator#toArray yet.
// eslint-disable-next-line unicorn/prefer-iterator-to-array
const DETAIL_BEST_EFFORT_DEFINITIONS = [...BEST_EFFORT_DEFINITIONS.values()].filter(
  (definition): definition is typeof definition & ({ distance: number } | { duration: number }) =>
    'distance' in definition || definition.type.startsWith('power_'),
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
    @Optional() private readonly importProgressStore?: ImportProgressStore,
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
    takeoutImportId,
  }: JobOf<JobName.ActivityParse>): Promise<JobStatus> {
    const upload = await this.uploadRepository.getById(id);
    if (!upload) {
      this.logger.warn(`Skipping parse of upload ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    const existing = await this.activityRepository.getByUploadId(id);
    if (existing) {
      if (!force) {
        const pendingJobs: JobItem[] = [];
        if (existing.metrics_computed_at === null) {
          pendingJobs.push({ name: JobName.ActivityMetricCompute, data: { id: existing.id } });
        } else if (existing.best_efforts_computed_at === null) {
          pendingJobs.push({ name: JobName.ActivityBestEffortCompute, data: { id: existing.id } });
        }
        if (existing.route_matches_computed_at === null) {
          pendingJobs.push({ name: JobName.ActivityRouteMatchCompute, data: { id: existing.id } });
        }
        if (pendingJobs.length > 0) {
          await this.jobRepository.queueAll(pendingJobs);
        }
        await this.uploadRepository.setStatus(id, 'parsed');
        if (takeoutImportId) {
          this.importProgressStore?.increment(takeoutImportId);
        }
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
      const parsed = this.parseActivityStructureFile(upload.storage_path, contents);
      const activityId = await this.databaseRepository.withTransaction(async (trx) => {
        const createdId = await this.activityRepository.create(
          this.toCreateInput(id, parsed, activityName, activityDescription, activitySport, upload.user_id),
          trx,
        );
        await Promise.all([
          this.jobRepository.queue(
            { name: JobName.ActivityMetricCompute, data: { id: createdId } },
            { transaction: trx },
          ),
          this.jobRepository.queue(
            { name: JobName.ActivityRouteMatchCompute, data: { id: createdId } },
            { transaction: trx },
          ),
        ]);
        return createdId;
      });

      await this.uploadRepository.setStatus(id, 'parsed');
      const activity = await this.activityRepository.getByUploadId(id);
      if (!activity) {
        throw new Error(`Activity ${activityId} disappeared immediately after it was created`);
      }
      await this.eventRepository.emit('ActivityCreate', this.toActivityDto(activity));
      if (takeoutImportId) {
        this.importProgressStore?.increment(takeoutImportId);
      }
      this.logger.log(`Parsed upload ${id} into activity ${activityId} (${activitySport ?? parsed.sport})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.uploadRepository.setStatus(id, 'failed', message);
      if (takeoutImportId) {
        this.importProgressStore?.increment(takeoutImportId, true);
      }
      throw error;
    }

    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityManualCreate, queue: QueueName.ActivityParsing })
  async handleActivityManualCreate(job: JobOf<JobName.ActivityManualCreate>): Promise<JobStatus> {
    const manualChecksum = job.sourceId ? `strava:${job.sourceId}` : `manual:${job.id}`;
    const existing = await this.uploadRepository.getByChecksum(manualChecksum, job.userId);
    const legacyExisting =
      !existing && job.userId && job.sourceId
        ? await this.uploadRepository.hasManualActivity(
            { startedAt: new Date(job.startedAt), sport: job.activitySport, elapsedTime: job.elapsedTime },
            job.userId,
          )
        : false;
    if (existing || legacyExisting) {
      if (job.takeoutImportId) {
        this.importProgressStore?.increment(job.takeoutImportId, false, true);
      }
      return JobStatus.Skipped;
    }

    const movingTime = job.movingTime ?? null;
    const distance = job.distance ?? null;
    const avgSpeed =
      job.avgSpeed ??
      (distance !== null && (movingTime ?? job.elapsedTime) > 0 ? distance / (movingTime ?? job.elapsedTime) : null);
    const createdId = await this.databaseRepository.withTransaction(async (trx) => {
      await this.uploadRepository.create(
        {
          id: job.id,
          checksum: manualChecksum,
          original_name: 'Strava manual activity',
          byte_size: 0,
          storage_path: '',
          user_id: job.userId,
          status: 'parsed',
        },
        trx,
      );
      const id = await this.activityRepository.create(
        {
          activity: {
            upload_id: job.id,
            sport: job.activitySport,
            name: job.activityName ?? null,
            description: job.activityDescription ?? null,
            started_at: new Date(job.startedAt),
            timezone_offset_minutes: null,
          },
          streams: [],
          laps: [],
        },
        trx,
      );
      await this.activityRepository.setMetrics(
        id,
        {
          elapsed_time: job.elapsedTime,
          moving_time: movingTime,
          distance,
          elevation_gain: job.elevationGain ?? null,
          elevation_loss: job.elevationLoss ?? null,
          avg_speed: avgSpeed,
          max_speed: job.maxSpeed ?? null,
          avg_hr: job.avgHr ?? null,
          max_hr: job.maxHr ?? null,
          avg_cadence: null,
          max_cadence: null,
          avg_power: null,
          max_power: null,
          normalized_power: null,
          calories: job.calories ?? null,
        },
        trx,
      );
      await this.jobRepository.queue({ name: JobName.ActivityBestEffortCompute, data: { id } }, { transaction: trx });
      return id;
    });
    const activity = await this.activityRepository.getById(createdId);
    if (activity) {
      await this.eventRepository.emit('ActivityCreate', this.toActivityDto(activity));
    }
    if (job.takeoutImportId) {
      this.importProgressStore?.increment(job.takeoutImportId);
    }
    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityMetricCompute, queue: QueueName.ActivityParsing })
  async handleActivityMetricCompute({ id }: JobOf<JobName.ActivityMetricCompute>): Promise<JobStatus> {
    const activity = await this.activityRepository.getById(id);
    if (!activity) {
      this.logger.warn(`Skipping metric computation for activity ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    const upload = await this.uploadRepository.getById(activity.upload_id);
    if (!upload) {
      this.logger.warn(`Skipping metric computation for activity ${id}: source upload no longer exists`);
      return JobStatus.Skipped;
    }

    const contents = await this.storageRepository.read(upload.storage_path);
    if (contents.length > UPLOAD_LIMITS.activityFileBytes) {
      throw new Error(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
    }
    const parsed = this.computeActivityFile(upload.storage_path, contents);
    const found = await this.databaseRepository.withTransaction(async (trx) => {
      const activityFound = await this.activityRepository.setMetrics(id, this.toMetrics(parsed), trx);
      if (activityFound) {
        await this.jobRepository.queue({ name: JobName.ActivityBestEffortCompute, data: { id } }, { transaction: trx });
      }
      return activityFound;
    });
    if (!found) {
      return JobStatus.Skipped;
    }

    const updated = await this.activityRepository.getById(id);
    if (updated) {
      await this.eventRepository.emit('ActivityUpdate', this.toActivityDto(updated));
    }
    this.logger.log(`Computed metrics for activity ${id}`);
    return JobStatus.Success;
  }

  private decodeActivityFile(path: string, contents: Buffer): FitMessages {
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
    return messages;
  }

  private parseActivityStructureFile(path: string, contents: Buffer): ParsedActivityStructure {
    return parseFitStructure(this.decodeActivityFile(path, contents));
  }

  private computeActivityFile(path: string, contents: Buffer): ParsedActivity {
    return parseFitMessages(this.decodeActivityFile(path, contents));
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
    if (found === null) {
      this.logger.warn(`Skipping best-effort computation for activity ${id}: metrics are still pending`);
      return JobStatus.Skipped;
    }
    if (!found) {
      this.logger.warn(`Skipping best-effort computation for activity ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: { id } });
    this.logger.log(`Computed best efforts for activity ${id}`);
    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityRouteMatchCompute, queue: QueueName.ActivityParsing })
  async handleActivityRouteMatchCompute({ id }: JobOf<JobName.ActivityRouteMatchCompute>): Promise<JobStatus> {
    const found = await this.activityRepository.recomputeRouteMatches(id);
    if (!found) {
      this.logger.warn(`Skipping route-match computation for activity ${id}: no longer exists`);
      return JobStatus.Skipped;
    }

    this.logger.log(`Computed route matches for activity ${id}`);
    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityBestEffortRank, queue: QueueName.ActivityParsing })
  async handleActivityBestEffortRank({ id }: JobOf<JobName.ActivityBestEffortRank> = {}): Promise<JobStatus> {
    await this.jobRepository.discardQueuedDuplicates(JobName.ActivityBestEffortRank);
    await this.activityRepository.refreshBestEffortRankings();
    if (id) {
      const updated = await this.activityRepository.getById(id);
      if (updated) {
        await this.eventRepository.emit('ActivityUpdate', this.toActivityDto(updated));
      }
    }
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

  async listRecent(
    { cursor, limit = 50, search }: { cursor?: string; limit?: number; search?: string },
    userId?: string,
  ) {
    const normalizedSearch = search?.trim() || undefined;
    const rows = await this.activityRepository.listRecentPage({
      limit: limit + 1,
      cursor: cursor ? this.decodeActivityCursor(cursor) : undefined,
      search: normalizedSearch,
      userId,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const topBestEfforts = await this.topBestEffortsForActivities(page);

    return {
      activities: page.map((row) => ({
        ...this.toActivityDto(row),
        track: this.toTrack(row.track_geojson),
        topBestEfforts: row.best_efforts_computed_at === null ? null : (topBestEfforts.get(row.id) ?? []),
      })),
      nextCursor: hasMore && last ? this.encodeActivityCursor(last.started_at, last.id) : null,
      total: await this.activityRepository.count(normalizedSearch, userId),
    };
  }

  async listBestEfforts(sport: BestEffortSport, type: BestEffortType, userId?: string) {
    const definitions = sport === 'run' ? RUNNING_BEST_EFFORTS : CYCLING_BEST_EFFORTS;
    const selected = definitions.find((effort) => effort.type === type);
    if (!selected) {
      throw new BadRequestException(`${type} is not a supported ${sport} best-effort distance`);
    }
    const sports = [...BEST_EFFORT_SPORTS[sport]];
    const [rows, availableRows] = await Promise.all([
      this.activityRepository.listBestEfforts(type, sports, userId),
      this.activityRepository.listAvailableBestEffortTypes(sports, userId),
    ]);
    const availableTypes = new Set(availableRows.map((row) => row.type));

    return {
      sport,
      type: selected.type,
      valueKind: selected.valueKind,
      higherIsBetter: selected.higherIsBetter,
      distance: 'distance' in selected ? selected.distance : null,
      duration: 'duration' in selected ? selected.duration : null,
      options: definitions
        .filter((definition) => availableTypes.has(definition.type))
        .map((definition) => ({
          type: definition.type,
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

  async getById(id: string, userId?: string) {
    const row = await this.activityRepository.getDetailById(id, userId);
    if (!row) {
      return;
    }

    const supportsActivityAnalysis =
      BEST_EFFORT_SPORTS.run.includes(row.sport) || CYCLING_ANALYSIS_SPORTS.has(row.sport);
    const [storedEfforts, streams] = await Promise.all([
      this.activityRepository.getBestEfforts(id),
      supportsActivityAnalysis ? this.activityRepository.getStreams(id) : Promise.resolve([]),
    ]);
    const track = this.toTrack(row.detail_track_geojson ?? row.track_geojson);

    return {
      ...this.toActivityDto(row),
      track,
      analysis: supportsActivityAnalysis ? buildActivityAnalysis(streams) : null,
      matchedRouteCount: row.route_matches_computed_at === null ? null : Number(row.matched_route_count),
      bestEfforts:
        row.best_efforts_computed_at === null
          ? null
          : DETAIL_BEST_EFFORT_DEFINITIONS.flatMap((definition) => {
              const effort = storedEfforts.find((candidate) => candidate.type === definition.type);
              return effort
                ? [
                    {
                      type: definition.type,
                      value: effort.value,
                      distance: effort.distance,
                      elapsedTime: effort.elapsed_time,
                      startTime: effort.start_time,
                      endTime: effort.end_time,
                      avgHr: effort.avg_hr,
                      elevationChange: effort.elevation_change,
                      overallRank: effort.overall_rank,
                      year: effort.year,
                      yearRank: effort.year_rank,
                    },
                  ]
                : [];
            }),
    };
  }

  async listMatchedRoutes(id: string, userId?: string) {
    const activity = await this.activityRepository.getById(id, userId);
    if (!activity) {
      return;
    }

    const matches = await this.activityRepository.listMatchedRoutes(id, userId);
    return {
      sourceActivityId: id,
      activities:
        activity.route_matches_computed_at === null ? null : matches.map((match) => this.toActivityDto(match)),
    };
  }

  async updateById(
    id: string,
    userId?: string,
    input: {
      name?: string | null;
      description?: string | null;
      sport?: ActivityType;
      startedAt?: Date;
      excludeFromRankings?: boolean;
    } = {},
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

    if (input.excludeFromRankings !== undefined) {
      mapped.exclude_from_rankings = input.excludeFromRankings;
    }

    const updated = await this.activityRepository.update(id, mapped, userId);
    if (updated && input.excludeFromRankings === true) {
      await Promise.all([
        this.jobRepository.queue({ name: JobName.ActivityBestEffortCompute, data: { id } }),
        this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} }),
      ]);
    } else if (updated && (input.sport !== undefined || input.excludeFromRankings === false)) {
      await Promise.all([
        this.jobRepository.queue({ name: JobName.ActivityBestEffortCompute, data: { id } }),
        this.jobRepository.queue({ name: JobName.ActivityRouteMatchCompute, data: { id } }),
      ]);
    } else if (updated && input.startedAt !== undefined) {
      await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} });
    }
    if (!updated) {
      return;
    }
    const updatedDto = this.toActivityDto(updated);
    await this.eventRepository.emit('ActivityUpdate', updatedDto);
    return updatedDto;
  }

  async deleteById(id: string, userId?: string): Promise<boolean> {
    if (!(await this.activityRepository.getById(id, userId))) {
      return false;
    }
    const status = await this.handleActivityDelete({ id });
    return status !== JobStatus.Skipped;
  }

  private toActivityDto(activity: ActivityRecord) {
    const {
      metrics,
      metrics_computed_at: metricsComputedAt,
      best_efforts_computed_at: _bestEffortsComputedAt,
      route_matches_computed_at: _routeMatchesComputedAt,
      ...core
    } = activity;
    const camelCased = Object.fromEntries(
      Object.entries(core).map(([key, value]) => [
        key.replaceAll(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase()),
        value,
      ]),
    );
    const camelCasedMetrics = metrics
      ? Object.fromEntries(
          Object.entries(metrics).map(([key, value]) => [
            key.replaceAll(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase()),
            value,
          ]),
        )
      : null;

    return ActivitySchema.parse({
      ...camelCased,
      metrics: metricsComputedAt === null ? null : camelCasedMetrics,
      startedAt: this.toIsoString(activity.started_at),
      createdAt: this.toIsoString(activity.created_at),
      updatedAt: this.toIsoString(activity.updated_at),
    });
  }

  private toTrack(trackGeoJson: string | null): { type: 'LineString'; coordinates: [number, number][] } | null {
    return trackGeoJson ? (JSON.parse(trackGeoJson) as { type: 'LineString'; coordinates: [number, number][] }) : null;
  }

  private toIsoString(value: Timestamp): string {
    return this.toDate(value).toISOString();
  }

  private toDate(value: Timestamp): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private async topBestEffortsForActivities(activities: ActivityListRecord[]) {
    const activityIds = new Set(activities.map(({ id }) => id));
    const result = new Map<string, { type: BestEffortType; value: number; overallRank: number; yearRank: number }[]>();
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
      efforts.push({ type: definition.type, value: row.value, overallRank: row.overall_rank, yearRank: row.year_rank });
      result.set(row.activity_id, efforts);
    }

    for (const [activityId, efforts] of result) {
      result.set(
        activityId,
        efforts
          .sort((left, right) => {
            const leftIsPower = left.type.startsWith('power_');
            const rightIsPower = right.type.startsWith('power_');
            if (leftIsPower !== rightIsPower) {
              return leftIsPower ? -1 : 1;
            }
            if (leftIsPower && rightIsPower) {
              const leftDefinition = BEST_EFFORT_DEFINITIONS.get(left.type);
              const rightDefinition = BEST_EFFORT_DEFINITIONS.get(right.type);
              const leftDuration = leftDefinition && 'duration' in leftDefinition ? leftDefinition.duration : 0;
              const rightDuration = rightDefinition && 'duration' in rightDefinition ? rightDefinition.duration : 0;
              return (
                rightDuration - leftDuration || left.overallRank - right.overallRank || left.yearRank - right.yearRank
              );
            }
            const leftDefinition = BEST_EFFORT_DEFINITIONS.get(left.type);
            const rightDefinition = BEST_EFFORT_DEFINITIONS.get(right.type);
            const leftDistance =
              leftDefinition && 'distance' in leftDefinition
                ? leftDefinition.distance
                : left.type === 'longest_ride'
                  ? Infinity
                  : 0;
            const rightDistance =
              rightDefinition && 'distance' in rightDefinition
                ? rightDefinition.distance
                : right.type === 'longest_ride'
                  ? Infinity
                  : 0;
            return (
              rightDistance - leftDistance || left.overallRank - right.overallRank || left.yearRank - right.yearRank
            );
          })
          .slice(0, 3),
      );
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
    parsed: ParsedActivityStructure,
    activityName?: string,
    activityDescription?: string,
    activitySport?: ActivityType,
    userId?: string | null,
  ): CreateActivityInput {
    return {
      activity: {
        upload_id: uploadId,
        user_id: userId ?? null,
        sport: activitySport ?? parsed.sport,
        name: activityName ?? parsed.name,
        description: activityDescription ?? null,
        started_at: parsed.startedAt,
        timezone_offset_minutes: parsed.timezoneOffset,
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

  private toMetrics(parsed: ParsedActivity): ActivityMetrics {
    return {
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
    };
  }
}
