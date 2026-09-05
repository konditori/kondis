import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { IMAGE_PROCESSING_VERSION } from 'src/constants';
import { ActivityImage, ActivityImageFile } from 'src/db/schema';
import { ActivityImageSchema, type ActivityImageUpdateDto } from 'src/dtos/activity-image.dto';
import { JobName } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { StoragePort } from 'src/ports/storage.port';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import type { DatabaseRepository } from 'src/repositories/database.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import type { KondisTransaction } from 'src/types';
import type { BufferedUploadedFileData } from 'src/types/uploads';

const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
};

export class WorkerActivityImageService {
  constructor(
    private readonly images: ActivityImageRepository,
    private readonly activities: ActivityRepository,
    private readonly storage: StoragePort,
    private readonly crypto: CryptoPort,
    private readonly database: DatabaseRepository,
    private readonly jobs: JobProducerPort,
    private readonly social: SocialRepository,
  ) {}

  async upload(
    activityId: string,
    file: BufferedUploadedFileData | undefined,
    caption: string | undefined,
    userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('Missing image upload');
    }
    if (file.buffer.length > UPLOAD_LIMITS.imageFileBytes) {
      throw new PayloadTooLargeException(`Image exceeds ${UPLOAD_LIMITS.imageFileBytes} bytes`);
    }
    const activity = await this.activities.getById(activityId, userId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const checksum = await this.crypto.sha256(file.buffer);
    const existing = await this.images.getByUploadChecksum(activity.upload_id, checksum);
    if (existing) {
      return this.toDto(existing, await this.images.getFiles(existing.id));
    }
    const storagePath = this.storage.buildTemporaryPath(extensionOf(file.originalname) || '.bin');
    await this.storage.write(storagePath, file.buffer);
    try {
      const sortOrder = await this.images.nextSortOrder(activity.upload_id);
      const image = await this.database.withTransaction((trx) =>
        this.queueForUpload(
          activity.upload_id,
          [
            {
              originalName: file.originalname,
              storagePath,
              checksum,
              caption: caption?.trim() || undefined,
              sortOrder,
            },
          ],
          trx,
        ).then(([created]) => created!),
      );
      return this.toDto(image, []);
    } catch (error) {
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
  }

  async queueForUpload(
    uploadId: string,
    stages: Array<{
      originalName: string;
      storagePath: string;
      checksum: string;
      caption?: string | null;
      sortOrder: number;
    }>,
    executor?: KondisTransaction,
  ) {
    const run = async (trx: KondisTransaction) => {
      const result: ActivityImage[] = [];
      for (const stage of stages) {
        let image = await this.images.getByUploadChecksum(uploadId, stage.checksum, trx);
        if (!image) {
          image = await this.images.create(
            {
              upload_id: uploadId,
              checksum: stage.checksum,
              original_name: stage.originalName,
              caption: stage.caption ?? null,
              sort_order: stage.sortOrder,
              status: 'pending',
              processing_version: IMAGE_PROCESSING_VERSION,
            },
            trx,
          );
        }
        result.push(image);
        if (image.status !== 'ready') {
          await this.jobs.queue(
            {
              name: JobName.ActivityImageIngest,
              data: {
                imageId: image.id,
                uploadId,
                storagePath: stage.storagePath,
                originalName: stage.originalName,
                checksum: stage.checksum,
              },
            },
            { transaction: trx },
          );
        }
      }
      return result;
    };
    return executor ? run(executor) : this.database.withTransaction(run);
  }

  async list(activityId: string, userId: string) {
    const activity = await this.activities.getById(activityId);
    if (!activity || !(await this.social.canViewActivity(activityId, userId))) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const images = await this.images.listForUpload(activity.upload_id);
    return images.map((image) => this.toDto(image, []));
  }

  async update(activityId: string, imageId: string, input: ActivityImageUpdateDto, userId: string) {
    const activity = await this.activities.getById(activityId, userId);
    const image = await this.images.getById(imageId, userId);
    if (!activity || !image || image.upload_id !== activity.upload_id) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const updated = await this.images.update(imageId, {
      caption: input.caption === undefined ? undefined : input.caption?.trim() || null,
      sort_order: input.sortOrder,
    });
    return this.toDto(updated ?? image, await this.images.getFiles(imageId));
  }

  async delete(activityId: string, imageId: string, userId: string): Promise<boolean> {
    const activity = await this.activities.getById(activityId, userId);
    const image = await this.images.getById(imageId, userId);
    if (!activity || !image || image.upload_id !== activity.upload_id) {
      return false;
    }
    const files = await this.images.getFiles(imageId);
    await this.database.withTransaction(async (trx) => {
      await this.images.delete(imageId, trx);
      if (files.length > 0) {
        await this.jobs.queue(
          { name: JobName.FileDelete, data: { paths: files.map((file) => file.storage_path) } },
          { transaction: trx },
        );
      }
    });
    return true;
  }

  async getFile(imageId: string, variant: 'original' | 'thumbnail' | 'preview', userId: string) {
    const image = await this.images.getById(imageId);
    if (!image) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const activity = await this.activities.getByUploadId(image.upload_id);
    if (!activity || !(await this.social.canViewActivity(activity.id, userId))) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const files = await this.images.getFiles(imageId);
    const file = files.find((candidate) => candidate.variant === variant);
    if (!file) {
      throw new NotFoundException(`Image ${imageId} variant ${variant} is not ready`);
    }
    return { ...file, absolutePath: this.storage.reference(file.storage_path) };
  }

  private toDto(image: ActivityImage, files: ActivityImageFile[]) {
    return ActivityImageSchema.parse({
      id: image.id,
      caption: image.caption,
      sortOrder: image.sort_order,
      width: image.width,
      height: image.height,
      status: image.status,
      thumbnail: files.some((file) => file.variant === 'thumbnail')
        ? `/api/v1/activity-images/${image.id}/thumbnail`
        : null,
      preview: files.some((file) => file.variant === 'preview') ? `/api/v1/activity-images/${image.id}/preview` : null,
      original: files.some((file) => file.variant === 'original')
        ? `/api/v1/activity-images/${image.id}/original`
        : null,
    });
  }
}
