import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { extname } from 'node:path';

import { Upload } from 'src/db/schema';
import { FitUploadResponseDto } from 'src/dtos/fit-upload.dto';
import { IJobRepository, JOB_REPOSITORY } from 'src/jobs/job.repository';
import { JobName } from 'src/jobs/job.types';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadedFitFile } from 'src/types';

/**
 * Receives files, stores bytes, records provenance, and hands parsing off to a job.
 *
 * Note what it does not do: it never imports a parser. It enqueues a job describing the work
 * and returns. The parse handler is discovered through the job seam at bootstrap, so this
 * service has no compile-time knowledge of it at all.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly uploads: UploadRepository,
    private readonly storage: StorageRepository,
    @Inject(JOB_REPOSITORY) private readonly jobs: IJobRepository,
  ) {}

  async uploadFit(file?: UploadedFitFile): Promise<FitUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.fit') {
      throw new BadRequestException('Only .fit files are accepted');
    }

    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    // Re-importing an archive is normal user behaviour, so identical content is a no-op
    // rather than an error or a duplicate activity.
    const existing = await this.uploads.getByChecksum(checksum);
    if (existing) {
      this.logger.log(`Upload ${checksum.slice(0, 12)} already exists as ${existing.id}`);
      return this.toResponse(existing, true);
    }

    // Written before the row is inserted. A file with no row is harmless garbage that the
    // next upload of the same content will simply overwrite with identical bytes; a row with
    // no file would be a broken record.
    const storagePath = this.storage.buildPath(checksum, extension);
    await this.storage.write(storagePath, file.buffer);

    let upload: Upload;
    try {
      upload = await this.uploads.create({
        checksum,
        original_name: file.originalname,
        byte_size: file.buffer.length,
        storage_path: storagePath,
      });
    } catch (error) {
      // Two concurrent uploads of identical content: the unique checksum constraint decided
      // the winner, so adopt its row.
      const raced = await this.uploads.getByChecksum(checksum);
      if (raced) {
        return this.toResponse(raced, true);
      }
      throw error;
    }

    await this.jobs.queue({ name: JobName.PARSE_ACTIVITY_FILE, data: { uploadId: upload.id } });

    return this.toResponse(upload, false);
  }

  private toResponse(upload: Upload, duplicate: boolean): FitUploadResponseDto {
    return {
      id: upload.id,
      checksum: upload.checksum,
      byteSize: upload.byte_size,
      duplicate,
    };
  }
}
