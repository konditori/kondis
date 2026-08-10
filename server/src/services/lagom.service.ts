import { ConsoleLogger, Injectable } from '@nestjs/common';

import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadService } from 'src/services/upload.service';
import { JobOf } from 'src/types';
import { extractLagomTakeout } from 'src/utils/lagom';

@Injectable()
export class LagomService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly uploadService: UploadService,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(LagomService.name);
  }

  @OnJob({ name: JobName.LagomTakeoutImport, queue: QueueName.BackgroundTask })
  async handleTakeoutImport({ id }: JobOf<JobName.LagomTakeoutImport>): Promise<JobStatus> {
    const upload = await this.uploadRepository.getById(id);
    if (!upload) {
      this.logger.warn(`Skipping Lagom takeout import ${id}: upload no longer exists`);
      return JobStatus.Skipped;
    }
    if (upload.status === 'parsed') {
      return JobStatus.Skipped;
    }

    let takeout;
    try {
      takeout = await extractLagomTakeout(await this.storageRepository.read(upload.storage_path));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.uploadRepository.setStatus(id, 'failed', message);
      throw error;
    }

    const errors = [...takeout.errors];
    let imported = 0;
    let duplicates = 0;

    for (const activity of takeout.activities) {
      try {
        const activityUpload = await this.uploadService.uploadFit(activity.file);
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
      `Imported Lagom takeout ${upload.original_name}: ${imported} new, ${duplicates} duplicate, ${takeout.skipped} skipped, ${errors.length} failed`,
    );

    await this.uploadRepository.setStatus(id, 'parsed');
    return JobStatus.Success;
  }
}
