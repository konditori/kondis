import { JobName, JobStatus } from 'src/enum';
import { ConsoleLogger } from 'src/logger';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { JobOf } from 'src/types/jobs';

const TEMPORARY_FILE_RETENTION_MS = 24 * 60 * 60 * 1000;

export class StorageService {
  constructor(
    private readonly storageRepository: StorageRepository,
    private readonly jobRepository: JobRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(StorageService.name);
  }

  async handleFileDelete({ paths }: JobOf<JobName.FileDelete>): Promise<JobStatus> {
    for (const path of paths) {
      await this.storageRepository.delete(path);
      this.logger.log(`Deleted file ${path}`);
    }

    return JobStatus.Success;
  }

  async handleTemporaryFileCleanup(): Promise<JobStatus> {
    const cutoff = new Date(Date.now() - TEMPORARY_FILE_RETENTION_MS);
    const referenced = await this.jobRepository.getReferencedTemporaryPaths();
    const deleted = await this.storageRepository.deleteTemporaryFilesOlderThan(cutoff, referenced);
    this.logger.log(`Deleted ${deleted.length} expired temporary file(s)`);

    return JobStatus.Success;
  }
}
