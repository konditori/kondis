import type { JobRepository } from 'src/contracts/job.repository';
import type { NewUpload, Upload } from 'src/db/schema';
import { JobName } from 'src/enum';
import type { UploadRepository } from 'src/repositories/upload.repository';
import type { KondisTransaction } from 'src/types';
import type { JobOf } from 'src/types/jobs';

export type RegisterActivityUploadInput = Pick<
  NewUpload,
  'checksum' | 'original_name' | 'byte_size' | 'storage_path' | 'user_id'
> &
  Partial<Pick<NewUpload, 'id'>> &
  Partial<Omit<JobOf<JobName.ActivityParse>, 'id'>>;

export type RegisterActivityUploadResult = {
  upload: Upload;
  created: boolean;
};

/*
 * Shared database finalization for every activity-file ingestion adapter.
 */
export class ActivityUploadService {
  constructor(
    private readonly uploads: UploadRepository,
    private readonly jobs: JobRepository,
  ) {}

  findExisting(userId: string, checksum: string, transaction?: KondisTransaction) {
    return this.uploads.getByChecksum(checksum, userId, transaction);
  }

  async registerInTransaction(
    input: RegisterActivityUploadInput,
    transaction: KondisTransaction,
  ): Promise<RegisterActivityUploadResult> {
    const {
      activityName,
      activityDescription,
      activitySport,
      activityTags,
      takeoutImportId,
      takeoutItemKey,
      images,
      ...upload
    } = input;
    const created = await this.uploads.createIfAbsent(upload, transaction);
    if (!created) {
      const existing = await this.uploads.getByChecksum(input.checksum, input.user_id, transaction);
      if (!existing) {
        throw new Error('Concurrent activity upload disappeared before it could be reused');
      }
      return { upload: existing, created: false };
    }
    await this.jobs.queue(
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
      { transaction },
    );
    return { upload: created, created: true };
  }
}
