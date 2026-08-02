import { ConsoleLogger, Injectable } from '@nestjs/common';

import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { StorageRepository } from 'src/repositories/storage.repository';
import { JobOf } from 'src/types';

@Injectable()
export class StorageService {
  constructor(
    private readonly storageRepository: StorageRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(StorageService.name);
  }

  /**
   * Remove files whose owning rows are already gone.
   *
   * Always enqueued after the database side of a delete has committed, never before: an
   * orphaned file is a wasted byte, an orphaned row is a broken activity. Deletion is
   * idempotent, so a retry after a partial run is harmless.
   */
  @OnJob({ name: JobName.FileDelete, queue: QueueName.Storage })
  async handleFileDelete({ paths }: JobOf<JobName.FileDelete>): Promise<JobStatus> {
    for (const path of paths) {
      await this.storageRepository.delete(path);
      this.logger.log(`Deleted file ${path}`);
    }

    return JobStatus.Success;
  }
}
