import { IMAGE_FILE_EXTENSIONS } from 'src/config/upload-formats';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import type { CryptoRepository } from 'src/contracts/crypto.repository';
import type { StorageRepository } from 'src/contracts/storage.repository';
import type { TakeoutPhotoMetadataDto } from 'src/dtos/upload.dto';
import { BadRequestException, PayloadTooLargeException } from 'src/errors';
import type { TakeoutRepository } from 'src/repositories/takeout.repository';
import type { UploadedFileData } from 'src/types/uploads';

// Stage one bounded photo at a time. Only server-generated storage paths reach jobs.
export async function stageTakeoutPhoto(
  progress: TakeoutRepository,
  storage: StorageRepository,
  crypto: CryptoRepository,
  importId: string,
  userId: string,
  metadata: TakeoutPhotoMetadataDto,
  file: UploadedFileData | undefined,
): Promise<boolean> {
  if (!file?.buffer) {
    throw new BadRequestException('Missing photo upload');
  }
  if (file.buffer.length > UPLOAD_LIMITS.imageFileBytes) {
    throw new PayloadTooLargeException('Photo exceeds the image size limit');
  }
  const extension = /\.[^./]+$/.exec(file.originalname)?.[0].toLowerCase();
  if (!extension || !IMAGE_FILE_EXTENSIONS.has(extension)) {
    throw new BadRequestException('Unsupported photo format');
  }
  const owner = await progress.get(importId, userId);
  if (!owner || ['completed', 'cancelled'].includes(owner.status)) {
    return false;
  }
  const storagePath = storage.buildTemporaryPath(extension);
  await storage.write(storagePath, file.buffer);
  try {
    const accepted = await progress.stagePhoto(importId, userId, metadata.itemKey, {
      ...metadata,
      originalName: file.originalname,
      storagePath,
      checksum: await crypto.sha256(file.buffer),
    });
    if (!accepted) {
      await storage.delete(storagePath);
    }
    return accepted;
  } catch (error) {
    await storage.delete(storagePath).catch(() => {});
    throw error;
  }
}
