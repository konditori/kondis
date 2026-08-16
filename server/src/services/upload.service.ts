import {
  BadRequestException,
  ConsoleLogger,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { LagomTakeoutParser } from 'src/imports/lagom-takeout.parser';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { ImportProgressStore } from 'src/state/import-progress.store';
import { JobOf, UploadedFileData } from 'src/types';

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
    private readonly lagomTakeoutParser: LagomTakeoutParser = new LagomTakeoutParser(),
    private readonly importProgressStore: ImportProgressStore = new ImportProgressStore(),
  ) {
    this.logger.setContext(UploadService.name);
  }

  async uploadActivity(file: UploadedFileData | undefined, userId?: string): Promise<FitUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .fit, .tcx and .gpx files are accepted');
    }
    if (file.buffer.length > UPLOAD_LIMITS.activityFileBytes) {
      throw new PayloadTooLargeException(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
    }

    await this.queueActivityUpload(file, undefined, undefined, undefined, userId);

    return { byteSize: file.buffer.length, queued: true };
  }

  @OnJob({ name: JobName.ActivityUpload, queue: QueueName.BackgroundTask })
  async handleActivityUpload({
    originalName,
    storagePath,
    checksum,
    activityName,
    activityDescription,
    activitySport,
    userId,
    takeoutImportId,
    images,
  }: JobOf<JobName.ActivityUpload>): Promise<JobStatus> {
    const extension = extname(originalName).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported activity upload extension: ${extension || 'none'}`);
    }

    const buffer = await this.storageRepository.read(storagePath);
    const actualChecksum = this.cryptoRepository.xxHash(buffer);
    if (actualChecksum !== checksum) {
      throw new Error(`Activity upload checksum mismatch: expected ${checksum}, got ${actualChecksum}`);
    }

    const existing = await this.uploadRepository.getByChecksum(checksum, userId);
    if (existing) {
      this.logger.log(`Upload ${checksum} already exists as ${existing.id}`);
      if (images?.length) {
        await this.jobRepository.queue({
          name: JobName.ActivityParse,
          data: { id: existing.id, images, takeoutImportId },
        });
      }
      if (takeoutImportId) {
        this.importProgressStore.increment(takeoutImportId, false, true);
      }
      return JobStatus.Skipped;
    }

    const permanentStoragePath = this.storageRepository.buildPath(checksum, extension);
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
            },
          },
          { transaction: trx },
        );
      });
    } catch (error) {
      const raced = await this.uploadRepository.getByChecksum(checksum, userId);
      if (raced) {
        if (takeoutImportId) {
          this.importProgressStore.increment(takeoutImportId, false, true);
        }
        return JobStatus.Skipped;
      }
      throw error;
    }

    return JobStatus.Success;
  }

  async uploadLagomTakeout(
    file: UploadedFileData | undefined,
    userId?: string,
  ): Promise<LagomTakeoutUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }
    if (extname(file.originalname).toLowerCase() !== '.zip') {
      throw new BadRequestException('Only a Strava takeout .zip file is accepted');
    }
    if (file.buffer.length > UPLOAD_LIMITS.takeoutFileBytes) {
      throw new PayloadTooLargeException(`Takeout file exceeds ${UPLOAD_LIMITS.takeoutFileBytes} bytes`);
    }

    const storagePath = this.storageRepository.buildTemporaryPath('.zip');
    await this.storageRepository.write(storagePath, file.buffer);

    const importId = crypto.randomUUID();
    this.importProgressStore.create(importId, userId ?? '');
    await this.jobRepository.queue({
      name: JobName.LagomTakeoutImport,
      data: {
        originalName: file.originalname,
        storagePath,
        takeoutImportId: importId,
        userId,
      },
    });

    return { byteSize: file.buffer.length, queued: true, importId };
  }

  getLagomTakeoutStatus(id: string, userId: string) {
    const importRecord = this.importProgressStore.get(id, userId);
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
    let queued = 0;
    const takeout = await this.lagomTakeoutParser.extractLagomTakeout(
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
              ...activity.manual,
              images: await this.stageImages(activity.images),
            },
          });
          queued += 1;
          return;
        }
        await this.queueActivityUpload(
          activity.file!,
          activity.name ?? undefined,
          activity.description ?? undefined,
          activity.sport ?? undefined,
          userId,
          takeoutImportId,
          activity.images,
        );
        queued += 1;
      },
    );

    if (takeoutImportId) {
      this.importProgressStore.setProcessing(takeoutImportId, queued);
    }
    if (takeoutImportId && takeout.errors.length > 0) {
      this.importProgressStore.fail(takeoutImportId, `${takeout.errors.length} activities could not be imported`);
    }

    this.logger.log(
      `Processed Strava takeout ${originalName}: ${queued} queued, ${takeout.skipped} skipped, ${takeout.errors.length} failed`,
    );

    return JobStatus.Success;
  }

  private async queueActivityUpload(
    file: UploadedFileData,
    activityName?: string,
    activityDescription?: string,
    activitySport?: JobOf<JobName.ActivityUpload>['activitySport'],
    userId?: string,
    takeoutImportId?: string,
    images: { file: UploadedFileData; caption: string | null; sortOrder: number }[] = [],
  ): Promise<void> {
    const checksum = this.cryptoRepository.xxHash(file.buffer);
    const storagePath = this.storageRepository.buildTemporaryPath(extname(file.originalname).toLowerCase());
    await this.storageRepository.write(storagePath, file.buffer);
    const stagedImages = await this.stageImages(images);

    await this.jobRepository.queue({
      name: JobName.ActivityUpload,
      data: {
        ...(userId && { userId }),
        originalName: file.originalname,
        storagePath,
        checksum,
        ...(activityName && { activityName }),
        ...(activityDescription && { activityDescription }),
        ...(activitySport && { activitySport }),
        ...(takeoutImportId && { takeoutImportId }),
        ...(stagedImages.length > 0 && { images: stagedImages }),
      },
    });
  }

  private async stageImages(images: { file: UploadedFileData; caption: string | null; sortOrder: number }[]) {
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
