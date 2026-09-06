import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { JobName, JobStatus } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { RealtimePort } from 'src/ports/realtime.port';
import type { StoragePort } from 'src/ports/storage.port';
import type { TransactionPort } from 'src/ports/transaction.port';
import type { ActivityRepository } from 'src/repositories/activity.repository';
import type { UploadRepository } from 'src/repositories/upload.repository';
import { ImportProgressStore } from 'src/state/import-progress.store';
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

  async uploadActivity(file: UploadedFileData | undefined, userId: string): Promise<FitUploadResponseDto> {
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
        },
      });
    } catch (error) {
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
    return { byteSize: file.size, queued: true };
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
      });
    }

    const permanentStoragePath = this.storage.buildPath(userId, checksum, extension);
    await this.storage.copy(storagePath, permanentStoragePath);

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
        if (takeoutImportId) {
          await this.progress.increment(takeoutImportId, false, true);
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
    options: Pick<JobOf<JobName.ActivityUpload>, 'activityTags' | 'images' | 'takeoutImportId'>,
  ): Promise<JobStatus> {
    const activity = await this.activities.getByUploadId(uploadId);
    if (activity) {
      await this.realtime.emit(
        'ActivityUploadSkipped',
        { id: activity.id, name: activity.name, sport: activity.sport },
        originalName,
      );
    }
    if (options.images?.length) {
      await this.jobs.queue({
        name: JobName.ActivityParse,
        data: { id: uploadId, ...options },
      });
    }
    if (options.takeoutImportId) {
      await this.progress.increment(options.takeoutImportId, false, true);
    }
    await this.storage.delete(storagePath);
    return JobStatus.Skipped;
  }

  async uploadLagomTakeout(file: UploadedFileData | undefined, userId: string): Promise<LagomTakeoutUploadResponseDto> {
    if (!file || !('buffer' in file) || !file.buffer) {
      throw new BadRequestException('Missing file upload');
    }
    const buffer = file.buffer;
    if (extensionOf(file.originalname) !== '.zip') {
      throw new BadRequestException('Only a Strava takeout .zip file is accepted');
    }
    if (file.size > UPLOAD_LIMITS.takeoutFileBytes) {
      throw new PayloadTooLargeException(`Takeout file exceeds ${UPLOAD_LIMITS.takeoutFileBytes} bytes`);
    }

    const storagePath = this.storage.buildTemporaryPath('.zip');
    const importId = crypto.randomUUID();
    await this.storage.write(storagePath, buffer);
    try {
      await this.progress.create(importId, userId);
      await this.jobs.queue({
        name: JobName.LagomTakeoutImport,
        data: { originalName: file.originalname, storagePath, takeoutImportId: importId, userId },
      });
    } catch (error) {
      await this.progress.fail(importId, error instanceof Error ? error.message : String(error)).catch(() => {});
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
    return { byteSize: file.size, queued: true, importId };
  }

  async getLagomTakeoutStatus(id: string, userId: string) {
    const record = await this.progress.get(id, userId);
    if (!record) {
      throw new NotFoundException('Lagom import not found');
    }
    return {
      importId: record.importId,
      status: record.status,
      total: record.total,
      processed: record.processed,
      failed: record.failed,
      duplicates: record.duplicates,
      error: record.error,
    };
  }
}
