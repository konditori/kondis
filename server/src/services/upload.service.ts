import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { Upload } from 'src/db/schema';
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

  async uploadFit(file?: UploadedFileData): Promise<FitUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .fit, .tcx and .gpx files are accepted');
    }

    const checksum = this.cryptoRepository.xxHash(file.buffer);

    const existing = await this.uploadRepository.getByChecksum(checksum);
    if (existing) {
      this.logger.log(`Upload ${checksum} already exists as ${existing.id}`);
      return { id: existing.id, checksum: existing.checksum, byteSize: existing.byte_size, duplicate: true };
    }

    const storagePath = this.storageRepository.buildPath(checksum, extension);
    await this.storageRepository.write(storagePath, file.buffer);

    let upload: Upload;
    try {
      upload = await this.databaseRepository.withTransaction(async (trx) => {
        const created = await this.uploadRepository.create(
          {
            checksum,
            original_name: file.originalname,
            byte_size: file.buffer.length,
            storage_path: storagePath,
          },
          trx,
        );

        await this.jobRepository.queue({ name: JobName.ActivityParse, data: { id: created.id } }, { transaction: trx });

        return created;
      });
    } catch (error) {
      const raced = await this.uploadRepository.getByChecksum(checksum);
      if (raced) {
        return { id: raced.id, checksum: raced.checksum, byteSize: raced.byte_size, duplicate: true };
      }
      throw error;
    }

    return { id: upload.id, checksum: upload.checksum, byteSize: upload.byte_size, duplicate: false };
  }

  async uploadLagomTakeout(file?: UploadedFileData): Promise<LagomTakeoutUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }
    if (extname(file.originalname).toLowerCase() !== '.zip') {
      throw new BadRequestException('Only a Strava takeout .zip file is accepted');
    }

    await this.jobRepository.queue({
      name: JobName.LagomTakeoutImport,
      data: {
        originalName: file.originalname,
        contents: file.buffer.toString('base64'),
      },
    });

    return { byteSize: file.buffer.length, queued: true };
  }

  @OnJob({ name: JobName.LagomTakeoutImport, queue: QueueName.BackgroundTask })
  async handleLagomTakeout({ originalName, contents }: JobOf<JobName.LagomTakeoutImport>): Promise<JobStatus> {
    const takeout = await extractLagomTakeout(Buffer.from(contents, 'base64'));

    const errors = [...takeout.errors];
    let imported = 0;
    let duplicates = 0;

    for (const activity of takeout.activities) {
      try {
        const activityUpload = await this.uploadFit(activity.file);
        if (activityUpload.duplicate) {
          duplicates += 1;
        } else {
          imported += 1;
        }
      } catch (error) {
        errors.push({
          row: activity.row,
          filename: activity.filename,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.log(
      `Imported Lagom takeout ${originalName}: ${imported} new, ${duplicates} duplicate, ${takeout.skipped} skipped, ${errors.length} failed`,
    );

    return JobStatus.Success;
  }
}
