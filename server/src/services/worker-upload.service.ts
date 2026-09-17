import { ACTIVITY_FILE_EXTENSIONS } from 'src/config/upload-formats';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import {
  FitUploadResponseDto,
  TakeoutActivityMetadataDto,
  TakeoutImportScanDto,
  TakeoutManualItemDto,
  TakeoutPhotoMetadataDto,
} from 'src/dtos/upload.dto';
import {
  ActivityType as ActivityTypeEnum,
  JobName,
  JobStatus,
  TakeoutImportItemKind,
  TakeoutImportItemTerminalStatus,
} from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import { ActivityUploadService } from 'src/services/activity-upload.service';
import type { BaseServiceDeps } from 'src/services/base.service';
import { BaseService } from 'src/services/base.service';
import type { TakeoutImportItem } from 'src/types';
import type { JobOf } from 'src/types/jobs';
import type { UploadedFileData } from 'src/types/uploads';
import { stageTakeoutPhoto } from 'src/utils/takeout-photo';

const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
};

export class WorkerUploadService extends BaseService {
  constructor(
    deps: BaseServiceDeps,
    private readonly activityUploads = new ActivityUploadService(deps.uploadRepository, deps.jobRepository),
  ) {
    super(deps);
  }

  async uploadActivity(
    file: UploadedFileData | undefined,
    userId: string,
    options: Partial<
      Pick<
        JobOf<JobName.ActivityUpload>,
        | 'activityName'
        | 'activityDescription'
        | 'activitySport'
        | 'activityTags'
        | 'takeoutImportId'
        | 'takeoutItemKey'
        | 'images'
      >
    > = {},
  ): Promise<FitUploadResponseDto> {
    if (!file || !('buffer' in file) || !file.buffer) {
      throw new BadRequestException('Missing file upload');
    }
    const buffer = file.buffer;
    const extension = extensionOf(file.originalname);
    if (!ACTIVITY_FILE_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .fit, .tcx and .gpx files are accepted');
    }
    if (file.size > UPLOAD_LIMITS.activityFileBytes) {
      throw new PayloadTooLargeException(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
    }

    const storagePath = this.storageRepository.buildTemporaryPath(extension);
    await this.storageRepository.write(storagePath, buffer);
    try {
      await this.jobRepository.queue({
        name: JobName.ActivityUpload,
        data: {
          userId,
          originalName: file.originalname,
          storagePath,
          checksum: await this.cryptoRepository.sha256(buffer),
          ...options,
        },
      });
    } catch (error) {
      await this.storageRepository.delete(storagePath).catch(() => {});
      throw error;
    }
    return { byteSize: file.size, queued: true };
  }

  async createTakeoutImport(userId: string) {
    const importId = crypto.randomUUID();
    await this.takeoutRepository.create(importId, userId);
    return { importId, status: 'scanning' as const };
  }

  scanTakeoutImport(importId: string, userId: string, scan: TakeoutImportScanDto): Promise<string[]> {
    return this.takeoutRepository.registerItems(
      importId,
      userId,
      scan.items.map(
        (item) =>
          ({
            itemKey: item.itemKey,
            kind: item.kind === 'activity' ? TakeoutImportItemKind.Activity : TakeoutImportItemKind.Manual,
            metadata: item,
          }) satisfies TakeoutImportItem,
      ),
    );
  }

  submitTakeoutPhoto(
    importId: string,
    userId: string,
    metadata: TakeoutPhotoMetadataDto,
    file: UploadedFileData | undefined,
  ): Promise<boolean> {
    return stageTakeoutPhoto(
      this.takeoutRepository,
      this.storageRepository,
      this.cryptoRepository,
      importId,
      userId,
      metadata,
      file,
    );
  }

  async submitTakeoutActivity(
    importId: string,
    userId: string,
    metadata: TakeoutActivityMetadataDto,
    file: UploadedFileData | undefined,
  ): Promise<boolean> {
    if (!(await this.takeoutRepository.beginItem(importId, userId, metadata.itemKey, TakeoutImportItemKind.Activity))) {
      return false;
    }
    try {
      await this.uploadActivity(file, userId, {
        activityName: metadata.name ?? undefined,
        activityDescription: metadata.description ?? undefined,
        activitySport: metadata.sport ?? undefined,
        activityTags: metadata.tags,
        takeoutImportId: importId,
        takeoutItemKey: metadata.itemKey,
        images: await this.takeoutRepository.getStagedPhotos(importId, userId, metadata.itemKey),
      });
      await this.takeoutRepository.markQueued(importId, metadata.itemKey);
      return true;
    } catch (error) {
      await this.takeoutRepository.completeItem(
        importId,
        metadata.itemKey,
        TakeoutImportItemTerminalStatus.Failed,
        errorMessage(error),
      );
      throw error;
    }
  }

  async submitTakeoutManual(importId: string, userId: string, item: TakeoutManualItemDto): Promise<boolean> {
    if (!(await this.takeoutRepository.beginItem(importId, userId, item.itemKey, TakeoutImportItemKind.Manual))) {
      return false;
    }
    try {
      await this.jobRepository.queue({
        name: JobName.ActivityManualCreate,
        data: {
          id: crypto.randomUUID(),
          userId,
          sourceId: item.sourceId,
          activityName: item.name ?? undefined,
          activityDescription: item.description ?? undefined,
          activitySport: item.sport,
          activityTags: item.tags,
          startedAt: item.startedAt,
          elapsedTime: item.elapsedTime,
          movingTime: item.movingTime,
          distance: item.distance,
          elevationGain: item.elevationGain,
          elevationLoss: item.elevationLoss,
          avgSpeed: item.avgSpeed,
          maxSpeed: item.maxSpeed,
          avgHr: item.avgHr,
          maxHr: item.maxHr,
          calories: item.calories,
          takeoutImportId: importId,
          takeoutItemKey: item.itemKey,
          images: await this.takeoutRepository.getStagedPhotos(importId, userId, item.itemKey),
        },
      });
      await this.takeoutRepository.markQueued(importId, item.itemKey);
      return true;
    } catch (error) {
      await this.takeoutRepository.completeItem(
        importId,
        item.itemKey,
        TakeoutImportItemTerminalStatus.Failed,
        errorMessage(error),
      );
      throw error;
    }
  }

  async finalizeTakeoutImport(importId: string, userId: string, extractionErrors: number) {
    return this.takeoutRepository.finalize(importId, userId, extractionErrors);
  }

  cancelTakeoutImport(importId: string, userId: string): Promise<boolean> {
    return this.takeoutRepository.cancel(importId, userId);
  }

  failTakeoutItem(importId: string, userId: string, itemKey: string, error: string): Promise<boolean> {
    return this.takeoutRepository.failItem(importId, userId, itemKey, error);
  }

  async getTakeoutImportStatus(id: string, userId: string) {
    const record = await this.takeoutRepository.get(id, userId);
    if (!record) {
      throw new NotFoundException('Takeout import not found');
    }
    return {
      importId: record.importId,
      status: record.status,
      total: record.total,
      uploaded: record.uploaded,
      processed: record.processed,
      failed: record.failed,
      duplicates: record.duplicates,
      error: record.error,
    };
  }

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
    takeoutItemKey,
    images,
  }: JobOf<JobName.ActivityUpload>): Promise<JobStatus> {
    if (!userId) {
      throw new Error('Activity upload job has no owner');
    }
    const extension = extensionOf(originalName);
    if (!ACTIVITY_FILE_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported activity upload extension: ${extension || 'none'}`);
    }
    if (expectedChecksum) {
      const existing = await this.uploadRepository.getByChecksum(expectedChecksum, userId);
      if (existing) {
        return this.handleExistingActivityUpload(existing.id, originalName, storagePath, {
          activityTags,
          images,
          takeoutImportId,
          takeoutItemKey,
        });
      }
    }
    const buffer = await this.storageRepository.readLimited(storagePath, UPLOAD_LIMITS.activityFileBytes);
    const checksum = await this.cryptoRepository.sha256(buffer);
    if (expectedChecksum && checksum !== expectedChecksum) {
      throw new Error(`Activity upload checksum mismatch: expected ${expectedChecksum}, got ${checksum}`);
    }

    const existing = await this.uploadRepository.getByChecksum(checksum, userId);
    if (existing) {
      return this.handleExistingActivityUpload(existing.id, originalName, storagePath, {
        activityTags,
        images,
        takeoutImportId,
        takeoutItemKey,
      });
    }

    const permanentStoragePath = this.storageRepository.buildPath(userId, checksum, extension);
    // The staged bytes are already in memory. Writing them directly avoids a
    // second complete R2 read just to copy the temporary object.
    await this.storageRepository.write(permanentStoragePath, buffer);

    const registration = await this.databaseRepository.withTransaction((transaction) =>
      this.activityUploads.registerInTransaction(
        {
          checksum,
          original_name: originalName,
          byte_size: buffer.length,
          storage_path: permanentStoragePath,
          user_id: userId,
          activityName,
          activityDescription,
          activitySport,
          activityTags,
          takeoutImportId,
          takeoutItemKey,
          images,
        },
        transaction,
      ),
    );
    if (!registration.created) {
      if (takeoutImportId && takeoutItemKey) {
        await this.takeoutRepository.completeItem(
          takeoutImportId,
          takeoutItemKey,
          TakeoutImportItemTerminalStatus.Duplicate,
        );
      }
      await this.storageRepository.delete(storagePath);
      return JobStatus.Skipped;
    }

    await this.storageRepository.delete(storagePath);
    return JobStatus.Success;
  }

  private async handleExistingActivityUpload(
    uploadId: string,
    originalName: string,
    storagePath: string,
    options: Pick<JobOf<JobName.ActivityUpload>, 'activityTags' | 'images' | 'takeoutImportId' | 'takeoutItemKey'>,
  ): Promise<JobStatus> {
    const activity = await this.activityRepository.getByUploadId(uploadId);
    if (activity) {
      await this.eventRepository.emit(
        'ActivityUploadSkipped',
        { id: activity.id, name: activity.name, sport: activity.sport as ActivityTypeEnum },
        originalName,
      );
    }
    if (options.images?.length) {
      await this.jobRepository.queue({
        name: JobName.ActivityParse,
        data: { id: uploadId, ...options },
      });
    }
    if (options.takeoutImportId && options.takeoutItemKey) {
      await this.takeoutRepository.completeItem(
        options.takeoutImportId,
        options.takeoutItemKey,
        TakeoutImportItemTerminalStatus.Duplicate,
      );
    }
    await this.storageRepository.delete(storagePath);
    return JobStatus.Skipped;
  }
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
