import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { IMAGE_PROCESSING_VERSION } from 'src/constants';
import { ActivityImage, ActivityImageFile } from 'src/db/schema';
import { ActivityImageSchema, type ActivityImageUpdateDto } from 'src/dtos/activity-image.dto';
import { JobName } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import { BaseService } from 'src/services/base.service';
import type { KondisTransaction } from 'src/types';
import type { BufferedUploadedFileData } from 'src/types/uploads';

const extensionOf = (name: string): string => {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index).toLowerCase();
};

export class WorkerActivityImageService extends BaseService {
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
    const activity = await this.activityRepository.getById(activityId, userId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const checksum = await this.cryptoRepository.sha256(file.buffer);
    const existing = await this.mediaRepository.getByActivityChecksum(activity.id, checksum);
    if (existing) {
      return this.toDto(existing, await this.mediaRepository.getFiles(existing.id));
    }
    const storagePath = this.storageRepository.buildTemporaryPath(extensionOf(file.originalname) || '.bin');
    await this.storageRepository.write(storagePath, file.buffer);
    try {
      const sortOrder = await this.mediaRepository.nextSortOrder(activity.id);
      const image = await this.databaseRepository.withTransaction((trx) =>
        this.queueForActivity(
          activity.id,
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
      await this.storageRepository.delete(storagePath).catch(() => {});
      throw error;
    }
  }

  async queueForActivity(
    activityId: string,
    stages: Array<{
      originalName: string;
      storagePath: string;
      checksum: string;
      caption?: string | null;
      sortOrder: number;
    }>,
    executor?: KondisTransaction,
  ) {
    const activity = await this.activityRepository.getById(activityId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const run = async (trx: KondisTransaction) => {
      const result: ActivityImage[] = [];
      for (const stage of stages) {
        let image = await this.mediaRepository.getByActivityChecksum(activityId, stage.checksum, trx);
        if (!image) {
          image = await this.mediaRepository.create(
            {
              activity_id: activityId,
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
          await this.jobRepository.queue(
            {
              name: JobName.ActivityImageIngest,
              data: {
                imageId: image.id,
                uploadId: activity.upload_id,
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
    return executor ? run(executor) : this.databaseRepository.withTransaction(run);
  }

  async list(activityId: string, userId: string) {
    const activity = await this.activityRepository.getById(activityId);
    if (!activity || !(await this.socialRepository.canViewActivity(activityId, userId))) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const images = await this.mediaRepository.listForActivity(activity.id);
    return images.map((image) => this.toDto(image, []));
  }

  async update(activityId: string, imageId: string, input: ActivityImageUpdateDto, userId: string) {
    const activity = await this.activityRepository.getById(activityId, userId);
    const image = await this.mediaRepository.getById(imageId, userId);
    if (!activity || !image || image.activity_id !== activity.id) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const updated = await this.mediaRepository.update(imageId, {
      caption: input.caption === undefined ? undefined : input.caption?.trim() || null,
      sort_order: input.sortOrder,
    });
    return this.toDto(updated ?? image, await this.mediaRepository.getFiles(imageId));
  }

  async delete(activityId: string, imageId: string, userId: string): Promise<boolean> {
    const activity = await this.activityRepository.getById(activityId, userId);
    const image = await this.mediaRepository.getById(imageId, userId);
    if (!activity || !image || image.activity_id !== activity.id) {
      return false;
    }
    const files = await this.mediaRepository.getFiles(imageId);
    await this.databaseRepository.withTransaction(async (trx) => {
      await this.mediaRepository.delete(imageId, trx);
      if (files.length > 0) {
        await this.jobRepository.queue(
          { name: JobName.FileDelete, data: { paths: files.map((file) => file.storage_path) } },
          { transaction: trx },
        );
      }
    });
    return true;
  }

  async getFile(imageId: string, variant: 'original' | 'thumbnail' | 'preview', userId: string) {
    const image = await this.mediaRepository.getById(imageId);
    if (!image) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const activity = await this.activityRepository.getById(image.activity_id);
    if (!activity || !(await this.socialRepository.canViewActivity(activity.id, userId))) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const files = await this.mediaRepository.getFiles(imageId);
    const file = files.find((candidate) => candidate.variant === variant);
    if (!file) {
      throw new NotFoundException(`Image ${imageId} variant ${variant} is not ready`);
    }
    return { ...file, absolutePath: this.storageRepository.reference(file.storage_path) };
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
