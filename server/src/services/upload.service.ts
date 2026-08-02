import { BadRequestException, ConsoleLogger, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { Upload } from 'src/db/schema';
import { FitUploadResponseDto } from 'src/dtos/upload.dto';
import { JobName } from 'src/enum';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UploadRepository } from 'src/repositories/upload.repository';
import { UploadedFitFile } from 'src/types';

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

        await this.jobRepository.queue(
          { name: JobName.ActivityParse, data: { id: created.id, source: 'upload' } },
          { transaction: trx },
        );

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
}
