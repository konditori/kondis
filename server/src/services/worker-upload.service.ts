import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import {
  FitUploadResponseDto,
  TakeoutActivityMetadataDto,
  TakeoutImportScanDto,
  TakeoutManualItemDto,
} from 'src/dtos/upload.dto';
import { ActivityType as ActivityTypeEnum, JobName, JobStatus } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { RealtimePort } from 'src/ports/realtime.port';
import type { StoragePort } from 'src/ports/storage.port';
import type { TransactionPort } from 'src/ports/transaction.port';
import type { ActivityRepository } from 'src/repositories/activity.repository';
import type { UploadRepository } from 'src/repositories/upload.repository';
import { ImportProgressStore, type TakeoutImportItem } from 'src/state/import-progress.store';
import type { JobOf } from 'src/types/jobs';
import type { UploadedFileData } from 'src/types/uploads';

const SUPPORTED_ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);
const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
};

export class WorkerUploadService {
  constructor(
    private readonly storage: StoragePort,
    private readonly crypto: CryptoPort,
    private readonly jobs: JobProducerPort,
    private readonly progress: ImportProgressStore,
    private readonly uploads: UploadRepository,
    private readonly activities: ActivityRepository,
    private readonly database: TransactionPort,
    private readonly realtime: RealtimePort,
  ) {}

  async uploadActivity(
    file: UploadedFileData | undefined,
    userId: string,
    options: Partial<
      Pick<
        JobOf<JobName.ActivityUpload>,
        'activityName' | 'activityDescription' | 'activitySport' | 'activityTags' | 'takeoutImportId' | 'takeoutItemKey'
      >
    > = {},
  ): Promise<FitUploadResponseDto> {
    if (!file || !('buffer' in file) || !file.buffer) {
      throw new BadRequestException('Missing file upload');
    }
    const buffer = file.buffer;
    const extension = extensionOf(file.originalname);
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .fit, .tcx and .gpx files are accepted');
    }
    if (file.size > UPLOAD_LIMITS.activityFileBytes) {
      throw new PayloadTooLargeException(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
    }

    const storagePath = this.storage.buildTemporaryPath(extension);
    await this.storage.write(storagePath, buffer);
    try {
      await this.jobs.queue({
        name: JobName.ActivityUpload,
        data: {
          userId,
          originalName: file.originalname,
          storagePath,
          checksum: await this.crypto.sha256(buffer),
          ...options,
        },
      });
    } catch (error) {
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
    return { byteSize: file.size, queued: true };
  }

  async createTakeoutImport(userId: string) {
    const importId = crypto.randomUUID();
    await this.progress.create(importId, userId);
    return { importId, status: 'scanning' as const };
  }

  scanTakeoutImport(importId: string, userId: string, scan: TakeoutImportScanDto): Promise<string[]> {
    return this.progress.registerItems(
      importId,
      userId,
      scan.items.map(
        (item) => ({ itemKey: item.itemKey, kind: item.kind, metadata: item }) satisfies TakeoutImportItem,
      ),
    );
  }

  async submitTakeoutActivity(
    importId: string,
    userId: string,
    metadata: TakeoutActivityMetadataDto,
    file: UploadedFileData | undefined,
  ): Promise<boolean> {
    if (!(await this.progress.beginItem(importId, userId, metadata.itemKey, 'activity'))) {
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
      });
      await this.progress.markQueued(importId, metadata.itemKey);
      return true;
    } catch (error) {
      await this.progress.completeItem(importId, metadata.itemKey, 'failed', errorMessage(error));
      throw error;
    }
  }

  async submitTakeoutManual(importId: string, userId: string, item: TakeoutManualItemDto): Promise<boolean> {
    if (!(await this.progress.beginItem(importId, userId, item.itemKey, 'manual'))) {
      return false;
    }
    try {
      await this.jobs.queue({
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
        },
      });
      await this.progress.markQueued(importId, item.itemKey);
      return true;
    } catch (error) {
      await this.progress.completeItem(importId, item.itemKey, 'failed', errorMessage(error));
      throw error;
    }
  }

  async finalizeTakeoutImport(importId: string, userId: string, extractionErrors: number) {
    return this.progress.finalize(importId, userId, extractionErrors);
  }

  cancelTakeoutImport(importId: string, userId: string): Promise<boolean> {
    return this.progress.cancel(importId, userId);
  }

  failTakeoutItem(importId: string, userId: string, itemKey: string, error: string): Promise<boolean> {
    return this.progress.failItem(importId, userId, itemKey, error);
  }

  async getTakeoutImportStatus(id: string, userId: string) {
    const record = await this.progress.get(id, userId);
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
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported activity upload extension: ${extension || 'none'}`);
    }
    if (expectedChecksum) {
      const existing = await this.uploads.getByChecksum(expectedChecksum, userId);
      if (existing) {
        return this.handleExistingActivityUpload(existing.id, originalName, storagePath, {
          activityTags,
          images,
          takeoutImportId,
          takeoutItemKey,
        });
      }
    }
    const buffer = await this.storage.readLimited(storagePath, UPLOAD_LIMITS.activityFileBytes);
    const checksum = await this.crypto.sha256(buffer);
    if (expectedChecksum && checksum !== expectedChecksum) {
      throw new Error(`Activity upload checksum mismatch: expected ${expectedChecksum}, got ${checksum}`);
    }

    const existing = await this.uploads.getByChecksum(checksum, userId);
    if (existing) {
      return this.handleExistingActivityUpload(existing.id, originalName, storagePath, {
        activityTags,
        images,
        takeoutImportId,
        takeoutItemKey,
      });
    }

    const permanentStoragePath = this.storage.buildPath(userId, checksum, extension);
    // The staged bytes are already in memory. Writing them directly avoids a
    // second complete R2 read just to copy the temporary object.
    await this.storage.write(permanentStoragePath, buffer);

    try {
      await this.database.withTransaction(async (transaction) => {
        const created = await this.uploads.create(
          {
            checksum,
            original_name: originalName,
            byte_size: buffer.length,
            storage_path: permanentStoragePath,
            user_id: userId,
          },
          transaction,
        );
        await this.jobs.queue(
          {
            name: JobName.ActivityParse,
            data: {
              id: created.id,
              ...(images?.length && { images }),
              ...(takeoutImportId && { takeoutImportId }),
              ...(takeoutItemKey && { takeoutItemKey }),
              ...(activityName && { activityName }),
              ...(activityDescription && { activityDescription }),
              ...(activitySport && { activitySport }),
              ...(activityTags?.length && { activityTags }),
            },
          },
          { transaction },
        );
      });
    } catch (error) {
      const raced = await this.uploads.getByChecksum(checksum, userId);
      if (raced) {
        if (takeoutImportId && takeoutItemKey) {
          await this.progress.completeItem(takeoutImportId, takeoutItemKey, 'duplicate');
        }
        await this.storage.delete(storagePath);
        return JobStatus.Skipped;
      }
      throw error;
    }

    await this.storage.delete(storagePath);
    return JobStatus.Success;
  }

  private async handleExistingActivityUpload(
    uploadId: string,
    originalName: string,
    storagePath: string,
    options: Pick<JobOf<JobName.ActivityUpload>, 'activityTags' | 'images' | 'takeoutImportId' | 'takeoutItemKey'>,
  ): Promise<JobStatus> {
    const activity = await this.activities.getByUploadId(uploadId);
    if (activity) {
      await this.realtime.emit(
        'ActivityUploadSkipped',
        { id: activity.id, name: activity.name, sport: activity.sport as ActivityTypeEnum },
        originalName,
      );
    }
    if (options.images?.length) {
      await this.jobs.queue({
        name: JobName.ActivityParse,
        data: { id: uploadId, ...options },
      });
    }
    if (options.takeoutImportId && options.takeoutItemKey) {
      await this.progress.completeItem(options.takeoutImportId, options.takeoutItemKey, 'duplicate');
    }
    await this.storage.delete(storagePath);
    return JobStatus.Skipped;
  }
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
