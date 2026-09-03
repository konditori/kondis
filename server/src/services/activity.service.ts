import { BadRequestException, ConsoleLogger, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { ACTIVITY_TAG_IDS, ACTIVITY_TYPES, CYCLING_BEST_EFFORTS, RUNNING_BEST_EFFORTS } from 'src/constants';
import { ActivityImage } from 'src/db/schema';
import { OnJob } from 'src/decorators';
import { ActivitySchema, type ActivityDetailDto } from 'src/dtos/activity.dto';
import type { SocialUser } from 'src/dtos/social.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { FitRepository } from 'src/repositories/fit.repository';
import { GpxRepository } from 'src/repositories/gpx.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { TcxRepository } from 'src/repositories/tcx.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { Timestamp } from 'src/schema/decorators';
import { ImportProgressStore } from 'src/state/import-progress.store';
import type { FitMessages } from 'src/types';
import {
  ActivityListRecord,
  ActivityMetrics,
  ActivityRecord,
  ActivityTag,
  ActivityType,
  BestEffortGroup,
  BestEffortType,
  CreateActivityInput,
  ParsedActivity,
  ParsedActivityStructure,
  UpdateActivityInput,
} from 'src/types';
import { JobItem, JobOf } from 'src/types/jobs';
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
  (definition) =>
    'distance' in definition ||
    definition.type === 'longest_ride' ||
    definition.type === 'biggest_climb' ||
    definition.type === 'elevation_gain' ||
    definition.type.startsWith('power_'),
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
    @Optional() private readonly activityImageRepository?: ActivityImageRepository,
    @Optional() private readonly socialRepository?: SocialRepository,
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
    activityTags,
    takeoutImportId,
    images,
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
        if (images?.length) {
          await this.jobRepository.queue({ name: JobName.ActivityImageAttach, data: { uploadId: upload.id, images } });
        }
        if (takeoutImportId) {
          await this.importProgressStore?.increment(takeoutImportId);
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
          this.toCreateInput(
            id,
            parsed,
            upload.user_id,
            activityName,
            activityDescription,
            activitySport,
            activityTags,
          ),
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
        if (images?.length) {
          await this.jobRepository.queue(
            { name: JobName.ActivityImageAttach, data: { uploadId: id, images } },
            { transaction: trx },
          );
        }
        return createdId;
      });

      await this.uploadRepository.setStatus(id, 'parsed');
      const activity = await this.activityRepository.getByUploadId(id);
      if (!activity) {
        throw new Error(`Activity ${activityId} disappeared immediately after it was created`);
      }
      await this.eventRepository.emit('ActivityCreate', this.toActivityDto(activity, upload.original_name));
      if (takeoutImportId) {
        await this.importProgressStore?.increment(takeoutImportId);
      }
      this.logger.log(`Parsed upload ${id} into activity ${activityId} (${activitySport ?? parsed.sport})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      await this.uploadRepository.setStatus(id, 'failed', message);
      if (takeoutImportId) {
        await this.importProgressStore?.increment(takeoutImportId, true);
      }
      throw error;
    }

    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityManualCreate, queue: QueueName.ActivityParsing })
  async handleActivityManualCreate(job: JobOf<JobName.ActivityManualCreate>): Promise<JobStatus> {
    if (!job.userId) {
      throw new Error('Manual activity job has no owner');
    }
    const userId = job.userId;
    const manualChecksum = job.sourceId ? `strava:${job.sourceId}` : `manual:${job.id}`;
    const existing = await this.uploadRepository.getByChecksum(manualChecksum, userId);
    const legacyExisting =
      !existing && job.sourceId
        ? await this.uploadRepository.hasManualActivity(
            { startedAt: new Date(job.startedAt), sport: job.activitySport, elapsedTime: job.elapsedTime },
            userId,
          )
        : false;
    if (existing || legacyExisting) {
      if (existing && job.images?.length) {
        await this.jobRepository.queue({
          name: JobName.ActivityImageAttach,
          data: { uploadId: existing.id, images: job.images },
        });
      }
      if (job.takeoutImportId) {
        await this.importProgressStore?.increment(job.takeoutImportId, false, true);
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
          user_id: userId,
          status: 'parsed',
        },
        trx,
      );
      const id = await this.activityRepository.create(
        {
          activity: {
            upload_id: job.id,
            user_id: userId,
            sport: job.activitySport,
            name: job.activityName ?? null,
            description: job.activityDescription ?? null,
            tags: job.activityTags ?? [],
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
      if (job.images?.length) {
        await this.jobRepository.queue(
          { name: JobName.ActivityImageAttach, data: { uploadId: job.id, images: job.images } },
          { transaction: trx },
        );
      }
      return id;
    });
    const activity = await this.activityRepository.getById(createdId);
    if (activity) {
      await this.eventRepository.emit('ActivityCreate', this.toActivityDto(activity));
    }
    if (job.takeoutImportId) {
      await this.importProgressStore?.increment(job.takeoutImportId);
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
      const [updated, storedEfforts] = await Promise.all([
        this.activityRepository.getById(id),
        this.activityRepository.getBestEfforts(id),
      ]);
      if (updated) {
        await Promise.all([
          this.eventRepository.emit('ActivityUpdate', this.toActivityDto(updated)),
          this.eventRepository.emit('ActivityBestEffortsAvailable', {
            id,
            bestEfforts:
              updated.best_efforts_computed_at === null ? null : this.toDetailBestEfforts(storedEfforts, updated.sport),
          }),
        ]);
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
    const activityImages = this.activityImageRepository
      ? await this.activityImageRepository.listForUpload(activity.upload_id)
      : [];
    const imageFiles = this.activityImageRepository
      ? await Promise.all(activityImages.map((image) => this.activityImageRepository!.getFiles(image.id)))
      : [];

    await this.databaseRepository.withTransaction(async (trx) => {
      // Cascades to the activity, its streams and its laps.
      await this.uploadRepository.delete(activity.upload_id, trx);

      if (upload) {
        await this.jobRepository.queue(
          {
            name: JobName.FileDelete,
            data: {
              paths: [upload.storage_path, ...imageFiles.flat().map((file) => file.storage_path)].filter(Boolean),
            },
          },
          { transaction: trx },
        );
      }

      await this.jobRepository.queue({ name: JobName.ActivityBestEffortRank, data: {} }, { transaction: trx });
    });

    this.logger.log(`Deleted activity ${id}`);

    return JobStatus.Success;
  }

  async listRecent(
    {
      cursor,
      limit = 50,
      search,
      tags: tagQuery,
      tagMatch = 'any',
    }: { cursor?: string; limit?: number; search?: string; tags?: string; tagMatch?: 'any' | 'all' },
    userId?: string,
    feedUserId?: string,
  ) {
    const normalizedSearch = search?.trim() || undefined;
    const tags = tagQuery
      ?.split(',')
      .map((tag) => tag.trim())
      .filter(Boolean) as ActivityTag[] | undefined;
    if (tags?.some((tag) => !ACTIVITY_TAG_IDS.includes(tag))) {
      throw new BadRequestException('Unknown activity tag');
    }
    const ownerFilter = feedUserId ? undefined : userId;
    const rows = await this.activityRepository.listRecentPage({
      limit: limit + 1,
      cursor: cursor ? this.decodeActivityCursor(cursor) : undefined,
      search: normalizedSearch,
      userId: ownerFilter,
      feedUserId,
      tags,
      tagMatch,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const [topBestEfforts, achievementCounts] = await Promise.all([
      this.topBestEffortsForActivities(page),
      page.length > 0
        ? this.activityRepository.countTopBestEfforts([...new Set(page.map(({ id }) => id))])
        : Promise.resolve([]),
    ]);
    const achievementCountByActivity = new Map(
      achievementCounts.map(({ activity_id, achievement_count }) => [activity_id, achievement_count]),
    );
    const imagesByActivity = await Promise.all(
      page.map((row) => this.listImageDtos(row.upload_id, feedUserId ? undefined : userId)),
    );

    return {
      activities: page.map((row, index) => ({
        ...this.toActivityDto(row),
        track: this.toTrack(row.track_geojson),
        topBestEfforts: row.best_efforts_computed_at === null ? null : (topBestEfforts.get(row.id) ?? []),
        achievementCount: row.best_efforts_computed_at === null ? null : (achievementCountByActivity.get(row.id) ?? 0),
        images: imagesByActivity[index],
      })),
      nextCursor: hasMore && last ? this.encodeActivityCursor(last.started_at, last.id) : null,
      total: await this.activityRepository.count(normalizedSearch, ownerFilter, tags, tagMatch, feedUserId),
    };
  }

  async feed(
    viewerId: string,
    query: { cursor?: string; limit?: number; search?: string; tags?: string; tagMatch?: 'any' | 'all' },
  ) {
    return this.decorateSocialActivities(await this.listRecent(query, viewerId, viewerId), viewerId);
  }

  async profileActivities(
    viewerId: string,
    targetId: string,
    query: { cursor?: string; limit?: number; search?: string; tags?: string; tagMatch?: 'any' | 'all' },
  ) {
    if (!this.socialRepository || !(await this.socialRepository.canViewUser(viewerId, targetId))) {
      throw new NotFoundException('Person does not exist');
    }
    return this.decorateSocialActivities(await this.listRecent(query, targetId), viewerId, targetId);
  }

  private async decorateSocialActivities(
    page: Awaited<ReturnType<ActivityService['listRecent']>>,
    viewerId: string,
    targetId?: string,
  ) {
    if (!this.socialRepository || page.activities.length === 0) {
      return page;
    }
    const ids = page.activities.map((activity) => activity.id);
    const [engagement, users] = await Promise.all([
      this.socialRepository.activityEngagement(ids, viewerId),
      targetId
        ? Promise.resolve([await this.socialRepository.getUser(targetId)])
        : Promise.all(
            [...new Set(page.activities.map((activity) => activity.userId).filter((id): id is string => !!id))].map(
              (id) => this.socialRepository!.getUser(id),
            ),
          ),
    ]);
    const userMap = new Map(users.filter((user): user is SocialUser => !!user).map((user) => [user.id, user]));
    const engagementMap = new Map(engagement.map((row) => [row.activity_id, row]));
    return {
      ...page,
      activities: page.activities.map((activity) => ({
        ...activity,
        athlete: userMap.get(targetId ?? activity.userId ?? ''),
        likeCount: Number(engagementMap.get(activity.id)?.like_count ?? 0),
        commentCount: Number(engagementMap.get(activity.id)?.comment_count ?? 0),
        viewerLiked: !!engagementMap.get(activity.id)?.viewer_liked,
      })),
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
    if (userId && this.socialRepository && !(await this.socialRepository.canViewActivity(id, userId))) {
      return;
    }
    const row = await this.activityRepository.getDetailById(id, this.socialRepository ? undefined : userId);
    if (!row) {
      return;
    }

    const supportsActivityAnalysis =
      BEST_EFFORT_SPORTS.run.includes(row.sport) || CYCLING_ANALYSIS_SPORTS.has(row.sport);
    const [storedEfforts, streams, images] = await Promise.all([
      this.activityRepository.getBestEfforts(id),
      supportsActivityAnalysis ? this.activityRepository.getStreams(id) : Promise.resolve([]),
      this.activityImageRepository?.listForUpload(row.upload_id) ?? Promise.resolve([]),
    ]);
    const track = this.toTrack(row.detail_track_geojson ?? row.track_geojson);
    const athlete = row.user_id && this.socialRepository ? await this.socialRepository.getUser(row.user_id) : undefined;

    const detail = {
      ...this.toActivityDto(row),
      ...(athlete && { athlete }),
      track,
      analysis: supportsActivityAnalysis ? buildActivityAnalysis(streams) : null,
      matchedRouteCount: row.route_matches_computed_at === null ? null : Number(row.matched_route_count),
      bestEfforts: row.best_efforts_computed_at === null ? null : this.toDetailBestEfforts(storedEfforts, row.sport),
      images: await Promise.all(
        images.filter((image) => image.status === 'ready').map((image) => this.toImageDto(image)),
      ),
    };
    if (!this.socialRepository || !userId) {
      return detail;
    }
    const engagements = await this.socialRepository.activityEngagement([id], userId);
    const engagement = engagements[0];
    return {
      ...detail,
      likeCount: Number(engagement?.like_count ?? 0),
      commentCount: Number(engagement?.comment_count ?? 0),
      viewerLiked: !!engagement?.viewer_liked,
    };
  }

  private async listImageDtos(uploadId: string, userId?: string) {
    if (!this.activityImageRepository) {
      return [];
    }
    const images = await this.activityImageRepository.listForUpload(uploadId, userId);
    return Promise.all(images.filter((image) => image.status === 'ready').map((image) => this.toImageDto(image)));
  }

  private async toImageDto(image: ActivityImage) {
    const files = (await this.activityImageRepository?.getFiles(image.id)) ?? [];
    return {
      id: image.id,
      caption: image.caption,
      sortOrder: image.sort_order,
      width: image.width,
      height: image.height,
      status: image.status,
      thumbnail: files.some((file) => file.variant === 'thumbnail')
        ? `/api/v1/activity-images/${image.id}/thumbnail`
        : null,
      preview: files.some((file) => file.variant === 'preview') ? `/api/v1/activity-images/${image.id}/preview` : null,
      original: files.some((file) => file.variant === 'original')
        ? `/api/v1/activity-images/${image.id}/original`
        : null,
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
      tags?: ActivityTag[];
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

    if (input.tags !== undefined) {
      const current = await this.activityRepository.getById(id, userId);
      if (!current) {
        return;
      }
      const tags = [...new Set(input.tags)];
      if (tags.some((tag) => !ACTIVITY_TAG_IDS.includes(tag))) {
        throw new BadRequestException('Unknown activity tag');
      }
      const sport = input.sport ?? current.sport;
      const longRun = tags.includes('long_run');
      if (longRun && !['run', 'trail_run', 'virtual_run'].includes(sport)) {
        throw new BadRequestException('Long Run is only available for run activities');
      }
      mapped.tags = tags;
    }

    const updated = await this.activityRepository.update(id, mapped, userId);
    const needsBestEffortCompute =
      updated !== undefined &&
      (input.sport !== undefined || input.tags !== undefined || input.excludeFromRankings === true);
    const needsRouteMatchCompute =
      updated !== undefined && (input.sport !== undefined || input.excludeFromRankings !== undefined);
    const needsRankRefresh =
      updated !== undefined && (input.excludeFromRankings !== undefined || input.startedAt !== undefined);
    if (needsBestEffortCompute || needsRouteMatchCompute) {
      const jobs: JobItem[] = [];
      if (needsBestEffortCompute) {
        jobs.push({ name: JobName.ActivityBestEffortCompute, data: { id } });
      }
      if (needsRouteMatchCompute) {
        jobs.push({ name: JobName.ActivityRouteMatchCompute, data: { id } });
      }
      if (needsRankRefresh && !needsBestEffortCompute) {
        jobs.push({ name: JobName.ActivityBestEffortRank, data: {} });
      }
      await this.jobRepository.queueAll(jobs);
    } else if (needsRankRefresh) {
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

  private toActivityDto(activity: ActivityRecord, uploadFileName?: string) {
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
      ...(uploadFileName && { uploadFileName }),
      metrics: metricsComputedAt === null ? null : camelCasedMetrics,
      startedAt: this.toIsoString(activity.started_at),
      createdAt: this.toIsoString(activity.created_at),
      updatedAt: this.toIsoString(activity.updated_at),
    });
  }

  private toDetailBestEfforts(
    storedEfforts: Awaited<ReturnType<ActivityRepository['getBestEfforts']>>,
    sport: ActivityType,
  ): NonNullable<ActivityDetailDto['bestEfforts']> {
    const allowedTypes = new Set(
      (BEST_EFFORT_SPORTS.run.includes(sport)
        ? RUNNING_BEST_EFFORTS
        : CYCLING_ANALYSIS_SPORTS.has(sport)
          ? CYCLING_BEST_EFFORTS
          : []
      ).map((definition) => definition.type),
    );
    return DETAIL_BEST_EFFORT_DEFINITIONS.flatMap((definition) => {
      if (!allowedTypes.has(definition.type)) {
        return [];
      }
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
      const seenRanks = new Set<number>();
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
          .filter((effort) => {
            const rank = effort.overallRank <= 3 ? effort.overallRank : effort.yearRank;
            if (seenRanks.has(rank)) {
              return false;
            }
            seenRanks.add(rank);
            return true;
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
    userId: string,
    activityName?: string,
    activityDescription?: string,
    activitySport?: ActivityType,
    activityTags: ActivityTag[] = [],
  ): CreateActivityInput {
    return {
      activity: {
        upload_id: uploadId,
        user_id: userId,
        sport: activitySport ?? parsed.sport,
        name: activityName ?? parsed.name,
        description: activityDescription ?? null,
        tags: activityTags,
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
