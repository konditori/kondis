import {
  BadRequestException,
  ConsoleLogger,
  Injectable,
  NotFoundException,
  Optional,
  PayloadTooLargeException,
} from '@nestjs/common';
import { rm } from 'node:fs/promises';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { LagomTakeoutParser, type LagomTakeoutContents } from 'src/imports/lagom-takeout.parser';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { EventRepository } from 'src/repositories/event.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { ImportProgressStore } from 'src/state/import-progress.store';
import { JobOf } from 'src/types/jobs';
import { BufferedUploadedFileData, UploadedFileData } from 'src/types/uploads';
import { asErrorMessage } from 'src/utils/misc';

const SUPPORTED_ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);

@Injectable()
export class UploadService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly cryptoRepository: CryptoRepository,
    private readonly databaseRepository: DatabaseRepository,
    private readonly jobRepository: JobRepository,
    private readonly logger: ConsoleLogger,
    private readonly lagomTakeoutParser: LagomTakeoutParser,
    private readonly importProgressStore: ImportProgressStore,
    @Optional() private readonly userRepository?: UserRepository,
    @Optional() private readonly activityRepository?: ActivityRepository,
    @Optional() private readonly eventRepository?: EventRepository,
  ) {
    this.logger.setContext(UploadService.name);
  }

  async uploadActivity(file: UploadedFileData | undefined, userId: string): Promise<FitUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      await this.discardUploadedFile(file);
      throw new BadRequestException('Only .fit, .tcx and .gpx files are accepted');
    }
    if (file.size > UPLOAD_LIMITS.activityFileBytes) {
      await this.discardUploadedFile(file);
      throw new PayloadTooLargeException(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
    }

    await this.queueActivityUpload(file, userId);

    return { byteSize: file.size, queued: true };
  }

  @OnJob({ name: JobName.ActivityUpload, queue: QueueName.BackgroundTask })
  async handleActivityUpload({
    originalName,
    storagePath,
    checksum: expectedChecksum,
    activityName,
    activityDescription,
    activitySport,
    activityTags,
    userId,
    takeoutImportId,
    images,
  }: JobOf<JobName.ActivityUpload>): Promise<JobStatus> {
    if (!userId) {
      throw new Error('Activity upload job has no owner');
    }
    const extension = extname(originalName).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported activity upload extension: ${extension || 'none'}`);
    }

    const buffer = await this.storageRepository.read(storagePath);
    const checksum = this.cryptoRepository.xxHash(buffer);
    if (expectedChecksum && checksum !== expectedChecksum) {
      throw new Error(`Activity upload checksum mismatch: expected ${expectedChecksum}, got ${checksum}`);
    }

    const existing = await this.uploadRepository.getByChecksum(checksum, userId);
    if (existing) {
      this.logger.log(`Upload ${checksum} already exists as ${existing.id}`);
      const activity = await this.activityRepository?.getByUploadId(existing.id);
      if (activity && this.eventRepository) {
        await this.eventRepository.emit(
          'ActivityUploadSkipped',
          { id: activity.id, name: activity.name, sport: activity.sport },
          originalName,
        );
      }
      if (images?.length) {
        await this.jobRepository.queue({
          name: JobName.ActivityParse,
          data: { id: existing.id, images, takeoutImportId, activityTags },
        });
      }
      if (takeoutImportId) {
        await this.importProgressStore.increment(takeoutImportId, false, true);
      }
      return JobStatus.Skipped;
    }

    const permanentStoragePath = this.storageRepository.buildPath(userId, checksum, extension);
    await this.storageRepository.write(permanentStoragePath, buffer);

    try {
      await this.databaseRepository.withTransaction(async (trx) => {
        const created = await this.uploadRepository.create(
          {
            checksum,
            original_name: originalName,
            byte_size: buffer.length,
            storage_path: permanentStoragePath,
            user_id: userId,
          },
          trx,
        );

        await this.jobRepository.queue(
          {
            name: JobName.ActivityParse,
            data: {
              id: created.id,
              ...(images?.length && { images }),
              ...(takeoutImportId && { takeoutImportId }),
              ...(activityName && { activityName }),
              ...(activityDescription && { activityDescription }),
              ...(activitySport && { activitySport }),
              ...(activityTags?.length && { activityTags }),
            },
          },
          { transaction: trx },
        );
      });
    } catch (error) {
      const raced = await this.uploadRepository.getByChecksum(checksum, userId);
      if (raced) {
        if (takeoutImportId) {
          await this.importProgressStore.increment(takeoutImportId, false, true);
        }
        return JobStatus.Skipped;
      }
      throw error;
    }

    return JobStatus.Success;
  }

  async uploadLagomTakeout(file: UploadedFileData | undefined, userId: string): Promise<LagomTakeoutUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }
    if (extname(file.originalname).toLowerCase() !== '.zip') {
      await this.discardUploadedFile(file);
      throw new BadRequestException('Only a Strava takeout .zip file is accepted');
    }
    if (file.size > UPLOAD_LIMITS.takeoutFileBytes) {
      await this.discardUploadedFile(file);
      throw new PayloadTooLargeException(`Takeout file exceeds ${UPLOAD_LIMITS.takeoutFileBytes} bytes`);
    }

    const storagePath = this.storageRepository.buildTemporaryPath('.zip');
    await this.stageUploadedFile(file, storagePath);

    const importId = crypto.randomUUID();
    await this.importProgressStore.create(importId, userId);
    try {
      await this.jobRepository.queue({
        name: JobName.LagomTakeoutImport,
        data: {
          originalName: file.originalname,
          storagePath,
          takeoutImportId: importId,
          userId,
        },
      });
    } catch (error) {
      await this.importProgressStore.fail(importId, asErrorMessage(error));
      throw error;
    }

    return { byteSize: file.size, queued: true, importId };
  }

  async getLagomTakeoutStatus(id: string, userId: string) {
    const importRecord = await this.importProgressStore.get(id, userId);
    if (!importRecord) {
      throw new NotFoundException('Lagom import not found');
    }
    return {
      importId: importRecord.importId,
      status: importRecord.status,
      total: importRecord.total,
      processed: importRecord.processed,
      failed: importRecord.failed,
      duplicates: importRecord.duplicates,
      error: importRecord.error,
    };
  }

  @OnJob({ name: JobName.LagomTakeoutImport, queue: QueueName.BackgroundTask })
  async handleLagomTakeout({
    originalName,
    storagePath,
    userId,
    takeoutImportId,
  }: JobOf<JobName.LagomTakeoutImport>): Promise<JobStatus> {
    if (!userId) {
      throw new Error('Takeout import job has no owner');
    }
    let queued = 0;
    let takeout: LagomTakeoutContents;
    try {
      takeout = await this.lagomTakeoutParser.extractLagomTakeout(
        await this.storageRepository.read(storagePath),
        async (activity) => {
          if (activity.manual) {
            await this.jobRepository.queue({
              name: JobName.ActivityManualCreate,
              data: {
                id: crypto.randomUUID(),
                userId,
                takeoutImportId,
                activityName: activity.name ?? undefined,
                activityDescription: activity.description ?? undefined,
                activitySport: activity.sport ?? 'other',
                activityTags: activity.tags,
                ...activity.manual,
                images: await this.stageImages(activity.images),
              },
            });
            queued += 1;
            return;
          }
          await this.queueActivityUpload(
            activity.file!,
            userId,
            activity.name ?? undefined,
            activity.description ?? undefined,
            activity.sport ?? undefined,
            takeoutImportId,
            activity.images,
            activity.tags,
          );
          queued += 1;
        },
      );
    } catch (error) {
      if (takeoutImportId) {
        await this.importProgressStore.fail(takeoutImportId, asErrorMessage(error));
      }
      throw error;
    }

    if (takeout.profile) {
      if (takeout.profile.firstName && takeout.profile.lastName && this.userRepository) {
        await this.userRepository.setNameParts(userId, takeout.profile.firstName, takeout.profile.lastName);
      }
      if (takeout.profile.avatar) {
        const avatarPath = this.storageRepository.buildTemporaryPath('.jpg');
        await this.storageRepository.write(avatarPath, takeout.profile.avatar.buffer);
        await this.jobRepository.queue({ name: JobName.UserAvatarUpload, data: { userId, storagePath: avatarPath } });
      }
    }

    if (takeoutImportId) {
      await this.importProgressStore.setProcessing(takeoutImportId, queued);
    }
    if (takeoutImportId && takeout.errors.length > 0) {
      await this.importProgressStore.fail(takeoutImportId, `${takeout.errors.length} activities could not be imported`);
    }

    this.logger.log(
      `Processed Strava takeout ${originalName}: ${queued} queued, ${takeout.skipped} skipped, ${takeout.errors.length} failed`,
    );

    return JobStatus.Success;
  }

  private async queueActivityUpload(
    file: UploadedFileData,
    userId: string,
    activityName?: string,
    activityDescription?: string,
    activitySport?: JobOf<JobName.ActivityUpload>['activitySport'],
    takeoutImportId?: string,
    images: { file: BufferedUploadedFileData; caption: string | null; sortOrder: number }[] = [],
    activityTags: JobOf<JobName.ActivityUpload>['activityTags'] = [],
  ): Promise<void> {
    const storagePath = this.storageRepository.buildTemporaryPath(extname(file.originalname).toLowerCase());
    await this.stageUploadedFile(file, storagePath);
    const checksum = file.buffer ? this.cryptoRepository.xxHash(file.buffer) : undefined;
    const stagedImages = await this.stageImages(images);

    await this.jobRepository.queue({
      name: JobName.ActivityUpload,
      data: {
        userId,
        originalName: file.originalname,
        storagePath,
        ...(checksum && { checksum }),
        ...(activityName && { activityName }),
        ...(activityDescription && { activityDescription }),
        ...(activitySport && { activitySport }),
        ...(activityTags?.length && { activityTags }),
        ...(takeoutImportId && { takeoutImportId }),
        ...(stagedImages.length > 0 && { images: stagedImages }),
      },
    });
  }

  private async stageUploadedFile(file: UploadedFileData, storagePath: string): Promise<void> {
    if ('buffer' in file && file.buffer) {
      await this.storageRepository.write(storagePath, file.buffer);
      return;
    }
    await this.storageRepository.importFile(file.path, storagePath);
  }

  private async discardUploadedFile(file: UploadedFileData): Promise<void> {
    if ('path' in file && file.path) {
      await rm(file.path, { force: true });
    }
  }

  private async stageImages(images: { file: BufferedUploadedFileData; caption: string | null; sortOrder: number }[]) {
    const staged: {
      originalName: string;
      storagePath: string;
      checksum: string;
      caption?: string;
      sortOrder: number;
    }[] = [];
    for (const image of images) {
      const storagePath = this.storageRepository.buildTemporaryPath(
        extname(image.file.originalname).toLowerCase() || '.bin',
      );
      await this.storageRepository.write(storagePath, image.file.buffer);
      staged.push({
        originalName: image.file.originalname,
        storagePath,
        checksum: this.cryptoRepository.xxHash(image.file.buffer),
        ...(image.caption && { caption: image.caption }),
        sortOrder: image.sortOrder,
      });
    }
    return staged;
  }
}
