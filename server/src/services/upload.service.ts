import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

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

    await this.jobRepository.queue({
      name: JobName.ActivityUpload,
      data: {
        originalName: file.originalname,
        contents: file.buffer.toString('base64'),
      },
    });

    return { byteSize: file.buffer.length, queued: true };
  }

  @OnJob({ name: JobName.ActivityUpload, queue: QueueName.BackgroundTask })
  async handleActivityUpload({ originalName, contents }: JobOf<JobName.ActivityUpload>): Promise<JobStatus> {
    const extension = extname(originalName).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported activity upload extension: ${extension || 'none'}`);
    }

    const buffer = Buffer.from(contents, 'base64');
    const checksum = this.cryptoRepository.xxHash(buffer);
    const existing = await this.uploadRepository.getByChecksum(checksum);
    if (existing) {
      this.logger.log(`Upload ${checksum} already exists as ${existing.id}`);
      return JobStatus.Skipped;
    }

    const storagePath = this.storageRepository.buildPath(checksum, extension);
    await this.storageRepository.write(storagePath, buffer);

    try {
      await this.databaseRepository.withTransaction(async (trx) => {
        const created = await this.uploadRepository.create(
          {
            checksum,
            original_name: originalName,
            byte_size: buffer.length,
            storage_path: storagePath,
          },
          trx,
        );

        await this.jobRepository.queue({ name: JobName.ActivityParse, data: { id: created.id } }, { transaction: trx });
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

    const storagePath = this.storageRepository.buildTemporaryPath('.zip');
    await this.storageRepository.write(storagePath, file.buffer);

    try {
      await this.jobRepository.queue({
        name: JobName.LagomTakeoutImport,
        data: {
          originalName: file.originalname,
          storagePath,
        },
      });
    } catch (error) {
      await this.storageRepository.delete(storagePath);
      throw error;
    }

    return { byteSize: file.buffer.length, queued: true };
  }

  @OnJob({ name: JobName.LagomTakeoutImport, queue: QueueName.BackgroundTask })
  async handleLagomTakeout({ originalName, storagePath }: JobOf<JobName.LagomTakeoutImport>): Promise<JobStatus> {
    const takeout = await extractLagomTakeout(await this.storageRepository.read(storagePath));

    let queued = 0;

    for (const activity of takeout.activities) {
      await this.jobRepository.queue({
        name: JobName.ActivityUpload,
        data: {
          originalName: activity.file.originalname,
          contents: activity.file.buffer.toString('base64'),
        },
      });
      queued += 1;
    }

    this.logger.log(
      `Processed Strava takeout ${originalName}: ${queued} queued, ${takeout.skipped} skipped, ${takeout.errors.length} failed`,
    );

    return JobStatus.Success;
  }
}
