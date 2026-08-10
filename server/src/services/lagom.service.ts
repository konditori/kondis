import { ConsoleLogger, Injectable } from '@nestjs/common';

import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { UploadService } from 'src/services/upload.service';
import { JobOf } from 'src/types';
import { extractLagomTakeout } from 'src/utils/lagom';

@Injectable()
export class LagomService {
  constructor(
    private readonly uploadService: UploadService,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(LagomService.name);
  }

  @OnJob({ name: JobName.LagomTakeoutImport, queue: QueueName.BackgroundTask })
  async handleTakeoutImport({ originalName, contents }: JobOf<JobName.LagomTakeoutImport>): Promise<JobStatus> {
    const takeout = await extractLagomTakeout(Buffer.from(contents, 'base64'));

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
      `Imported Lagom takeout ${originalName}: ${imported} new, ${duplicates} duplicate, ${takeout.skipped} skipped, ${errors.length} failed`,
    );

    return JobStatus.Success;
  }
}
