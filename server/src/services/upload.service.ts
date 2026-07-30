import { BadRequestException, ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { Upload } from 'src/db/schema';
import { FitUploadResponseDto } from 'src/dtos/upload.dto';
import { IJobRepository, JOB_REPOSITORY } from 'src/jobs/job.repository';
import { JobName } from 'src/jobs/job.types';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadedFitFile } from 'src/types';

@Injectable()
export class UploadService {
  constructor(
    private readonly uploadRepository: UploadRepository,
    private readonly storageRepository: StorageRepository,
    private readonly cryptoRepository: CryptoRepository,
    @Inject(JOB_REPOSITORY) private readonly jobs: IJobRepository,
    private readonly logger: ConsoleLogger,
  ) {
    this.logger.setContext(UploadService.name);
  }

  async uploadFit(file?: UploadedFitFile): Promise<FitUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    const extension = extname(file.originalname).toLowerCase();
    if (extension !== '.fit') {
      throw new BadRequestException('Only .fit files are accepted');
    }

    const checksum = this.cryptoRepository.xxHash(file.buffer);

    const existing = await this.uploadRepository.getByChecksum(checksum);
    if (existing) {
      this.logger.log(`Upload ${checksum.slice(0, 12)} already exists as ${existing.id}`);
      return { id: existing.id, checksum: existing.checksum, byteSize: existing.byte_size, duplicate: true };
    }

    // Write file first, then create the database row
    const storagePath = this.storageRepository.buildPath(checksum, extension);
    await this.storageRepository.write(storagePath, file.buffer);

    let upload: Upload;
    try {
      upload = await this.uploadRepository.create({
        checksum,
        original_name: file.originalname,
        byte_size: file.buffer.length,
        storage_path: storagePath,
      });
    } catch (error) {
      const raced = await this.uploadRepository.getByChecksum(checksum);
      if (raced) {
        return { id: raced.id, checksum: raced.checksum, byteSize: raced.byte_size, duplicate: true };
      }
      throw error;
    }

    await this.jobs.queue({ name: JobName.PARSE_ACTIVITY_FILE, data: { uploadId: upload.id } });

    return { id: upload.id, checksum: upload.checksum, byteSize: upload.byte_size, duplicate: false };
  }
}
