import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { FitUploadResponseDto, LagomTakeoutUploadResponseDto } from 'src/dtos/upload.dto';
import { JobName } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { StoragePort } from 'src/ports/storage.port';
import { ImportProgressStore } from 'src/state/import-progress.store';
import type { UploadedFileData } from 'src/types/uploads';

const SUPPORTED_ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);
const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
};

export class WorkerUploadService {
  constructor(
    private readonly storage: StoragePort,
    private readonly crypto: CryptoPort,
    private readonly jobs: JobProducerPort,
    private readonly progress: ImportProgressStore,
  ) {}

  async uploadActivity(file: UploadedFileData | undefined, userId: string): Promise<FitUploadResponseDto> {
    if (!file || !('buffer' in file) || !file.buffer) {
      throw new BadRequestException('Missing file upload');
    }
    const buffer = file.buffer;
    const extension = extensionOf(file.originalname);
    if (!SUPPORTED_ACTIVITY_EXTENSIONS.has(extension)) {
      throw new BadRequestException('Only .fit, .tcx and .gpx files are accepted');
    }
    if (file.size > UPLOAD_LIMITS.activityFileBytes) {
      throw new PayloadTooLargeException(`Activity file exceeds ${UPLOAD_LIMITS.activityFileBytes} bytes`);
    }

    const storagePath = this.storage.buildTemporaryPath(extension);
    await this.storage.write(storagePath, buffer);
    try {
      await this.jobs.queue({
        name: JobName.ActivityUpload,
        data: {
          userId,
          originalName: file.originalname,
          storagePath,
          checksum: await this.crypto.sha256(buffer),
        },
      });
    } catch (error) {
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
    return { byteSize: file.size, queued: true };
  }

  async uploadLagomTakeout(file: UploadedFileData | undefined, userId: string): Promise<LagomTakeoutUploadResponseDto> {
    if (!file || !('buffer' in file) || !file.buffer) {
      throw new BadRequestException('Missing file upload');
    }
    const buffer = file.buffer;
    if (extensionOf(file.originalname) !== '.zip') {
      throw new BadRequestException('Only a Strava takeout .zip file is accepted');
    }
    if (file.size > UPLOAD_LIMITS.takeoutFileBytes) {
      throw new PayloadTooLargeException(`Takeout file exceeds ${UPLOAD_LIMITS.takeoutFileBytes} bytes`);
    }

    const storagePath = this.storage.buildTemporaryPath('.zip');
    const importId = crypto.randomUUID();
    await this.storage.write(storagePath, buffer);
    try {
      await this.progress.create(importId, userId);
      await this.jobs.queue({
        name: JobName.LagomTakeoutImport,
        data: { originalName: file.originalname, storagePath, takeoutImportId: importId, userId },
      });
    } catch (error) {
      await this.progress.fail(importId, error instanceof Error ? error.message : String(error)).catch(() => {});
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
    return { byteSize: file.size, queued: true, importId };
  }

  async getLagomTakeoutStatus(id: string, userId: string) {
    const record = await this.progress.get(id, userId);
    if (!record) {
      throw new NotFoundException('Lagom import not found');
    }
    return {
      importId: record.importId,
      status: record.status,
      total: record.total,
      processed: record.processed,
      failed: record.failed,
      duplicates: record.duplicates,
      error: record.error,
    };
  }
}
