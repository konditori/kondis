import { BadRequestException, ConsoleLogger, Injectable, PayloadTooLargeException } from '@nestjs/common';
import { extname } from 'node:path';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { JobOf, UploadedFileData } from 'src/types';
import { extractLagomTakeout } from 'src/utils/lagom';

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
  ) {
    this.logger.setContext(UploadService.name);
  }

  async uploadActivity(file?: UploadedFileData): Promise<FitUploadResponseDto> {
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

    await this.queueActivityUpload(file);

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

    const existing = await this.uploadRepository.getByChecksum(checksum);
    if (existing) {
      if (activityName || activityDescription || activitySport) {
        await this.jobRepository.queue({
          name: JobName.ActivityParse,
          data: {
            id: existing.id,
            force: true,
            ...(activityName && { activityName }),
            ...(activityDescription && { activityDescription }),
            ...(activitySport && { activitySport }),
          },
        });
        return JobStatus.Success;
      }

      this.logger.log(`Upload ${checksum} already exists as ${existing.id}`);
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
          },
          trx,
        );

        await this.jobRepository.queue(
          {
            name: JobName.ActivityParse,
            data: {
              id: created.id,
              ...(activityName && { activityName }),
              ...(activityDescription && { activityDescription }),
              ...(activitySport && { activitySport }),
            },
          },
          { transaction: trx },
        );
      });
    } catch (error) {
      const raced = await this.uploadRepository.getByChecksum(checksum);
      if (raced) {
        return JobStatus.Skipped;
      }
      throw error;
    }

    return JobStatus.Success;
  }

  async uploadLagomTakeout(file?: UploadedFileData): Promise<LagomTakeoutUploadResponseDto> {
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

    await this.jobRepository.queue({
      name: JobName.LagomTakeoutImport,
      data: {
        originalName: file.originalname,
        storagePath,
      },
    });

    return { byteSize: file.buffer.length, queued: true };
  }

  @OnJob({ name: JobName.LagomTakeoutImport, queue: QueueName.BackgroundTask })
  async handleLagomTakeout({ originalName, storagePath }: JobOf<JobName.LagomTakeoutImport>): Promise<JobStatus> {
    let queued = 0;
    const takeout = await extractLagomTakeout(await this.storageRepository.read(storagePath), async (activity) => {
      await this.queueActivityUpload(
        activity.file,
        activity.name ?? undefined,
        activity.description ?? undefined,
        activity.sport ?? undefined,
      );
      queued += 1;
    });

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
  ): Promise<void> {
    const checksum = this.cryptoRepository.xxHash(file.buffer);
    const storagePath = this.storageRepository.buildTemporaryPath(extname(file.originalname).toLowerCase());
    await this.storageRepository.write(storagePath, file.buffer);

    await this.jobRepository.queue({
      name: JobName.ActivityUpload,
      data: {
        originalName: file.originalname,
        storagePath,
        checksum,
        ...(activityName && { activityName }),
        ...(activityDescription && { activityDescription }),
        ...(activitySport && { activitySport }),
      },
    });
  }
}
