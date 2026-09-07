import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import {
  FitUploadResponseDto,
  TakeoutActivityMetadataDto,
  TakeoutImportScanDto,
  TakeoutManualItemDto,
} from 'src/dtos/upload.dto';
import { JobName, JobStatus } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import { ConsoleLogger } from 'src/logger';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { RealtimePort } from 'src/ports/realtime.port';
import type { StoragePort } from 'src/ports/storage.port';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { ImportProgressStore, type TakeoutImportItem } from 'src/state/import-progress.store';
import { JobOf } from 'src/types/jobs';
import { UploadedFileData } from 'src/types/uploads';

const SUPPORTED_ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);

export class UploadService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StoragePort,
    private readonly cryptoRepository: CryptoPort,
    private readonly databaseRepository: DatabaseRepository,
    private readonly jobRepository: JobProducerPort,
    private readonly logger: ConsoleLogger,
    private readonly importProgressStore: ImportProgressStore,
    private readonly activityRepository?: ActivityRepository,
    private readonly eventRepository?: RealtimePort,
  ) {
    this.logger.setContext(UploadService.name);
  }

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

    await this.queueActivityUpload(file, userId, options);

    return { byteSize: file.size, queued: true };
  }

  async createTakeoutImport(userId: string) {
    const importId = crypto.randomUUID();
    await this.importProgressStore.create(importId, userId);
    return { importId, status: 'scanning' as const };
  }

  scanTakeoutImport(importId: string, userId: string, scan: TakeoutImportScanDto): Promise<string[]> {
    return this.importProgressStore.registerItems(
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
    if (!(await this.importProgressStore.beginItem(importId, userId, metadata.itemKey, 'activity'))) {
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
      await this.importProgressStore.markQueued(importId, metadata.itemKey);
      return true;
    } catch (error) {
      await this.importProgressStore.completeItem(importId, metadata.itemKey, 'failed', errorMessage(error));
      throw error;
    }
  }

  async submitTakeoutManual(importId: string, userId: string, item: TakeoutManualItemDto): Promise<boolean> {
    if (!(await this.importProgressStore.beginItem(importId, userId, item.itemKey, 'manual'))) {
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
        },
      });
      await this.importProgressStore.markQueued(importId, item.itemKey);
      return true;
    } catch (error) {
      await this.importProgressStore.completeItem(importId, item.itemKey, 'failed', errorMessage(error));
      throw error;
    }
  }

  finalizeTakeoutImport(importId: string, userId: string, extractionErrors: number) {
    return this.importProgressStore.finalize(importId, userId, extractionErrors);
  }

  cancelTakeoutImport(importId: string, userId: string): Promise<boolean> {
    return this.importProgressStore.cancel(importId, userId);
  }

  failTakeoutItem(importId: string, userId: string, itemKey: string, error: string): Promise<boolean> {
    return this.importProgressStore.failItem(importId, userId, itemKey, error);
  }

  async getTakeoutImportStatus(id: string, userId: string) {
    const record = await this.importProgressStore.get(id, userId);
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
    const extension = extname(originalName).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported activity upload extension: ${extension || 'none'}`);
    }

    const buffer = await this.storageRepository.readLimited(storagePath, UPLOAD_LIMITS.activityFileBytes);
    const byteSize = buffer.length;
    const checksum = await this.cryptoRepository.sha256(buffer);
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
          data: { id: existing.id, images, takeoutImportId, takeoutItemKey, activityTags },
        });
      }
      if (takeoutImportId && takeoutItemKey) {
        await this.importProgressStore.completeItem(takeoutImportId, takeoutItemKey, 'duplicate');
      }
      return JobStatus.Skipped;
    }

    const permanentStoragePath = this.storageRepository.buildPath(userId, checksum, extension);
    await this.storageRepository.copy(storagePath, permanentStoragePath);

    try {
      await this.databaseRepository.withTransaction(async (trx) => {
        const created = await this.uploadRepository.create(
          {
            checksum,
            original_name: originalName,
            byte_size: byteSize,
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
              ...(takeoutItemKey && { takeoutItemKey }),
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
        if (takeoutImportId && takeoutItemKey) {
          await this.importProgressStore.completeItem(takeoutImportId, takeoutItemKey, 'duplicate');
        }
        return JobStatus.Skipped;
      }
      throw error;
    }

    return JobStatus.Success;
  }

  private async queueActivityUpload(
    file: UploadedFileData,
    userId: string,
    options: Partial<
      Pick<
        JobOf<JobName.ActivityUpload>,
        'activityName' | 'activityDescription' | 'activitySport' | 'activityTags' | 'takeoutImportId' | 'takeoutItemKey'
      >
    > = {},
  ): Promise<void> {
    const storagePath = this.storageRepository.buildTemporaryPath(extname(file.originalname).toLowerCase());
    await this.stageUploadedFile(file, storagePath);
    const checksum = file.buffer ? await this.cryptoRepository.sha256(file.buffer) : undefined;

    await this.jobRepository.queue({
      name: JobName.ActivityUpload,
      data: {
        userId,
        originalName: file.originalname,
        storagePath,
        ...(checksum && { checksum }),
        ...(options.activityName && { activityName: options.activityName }),
        ...(options.activityDescription && { activityDescription: options.activityDescription }),
        ...(options.activitySport && { activitySport: options.activitySport }),
        ...(options.activityTags?.length && { activityTags: options.activityTags }),
        ...(options.takeoutImportId && { takeoutImportId: options.takeoutImportId }),
        ...(options.takeoutItemKey && { takeoutItemKey: options.takeoutItemKey }),
      },
    });
  }

  private async stageUploadedFile(file: UploadedFileData, storagePath: string): Promise<void> {
    if ('buffer' in file && file.buffer) {
      await this.storageRepository.write(storagePath, file.buffer);
      return;
    }
    if (!this.storageRepository.importFile) {
      throw new Error('The configured storage does not support importing local files');
    }
    await this.storageRepository.importFile(file.path, storagePath);
  }

  private async discardUploadedFile(file: UploadedFileData): Promise<void> {
    if (!('path' in file) || !file.path) {
      return;
    }
    if (!this.storageRepository.deleteExternal) {
      throw new Error('The configured storage does not support deleting local files');
    }
    await this.storageRepository.deleteExternal(file.path);
  }
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
