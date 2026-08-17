import {
  BadRequestException,
  ConsoleLogger,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { extname } from 'node:path';
import sharp from 'sharp';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import type { KondisTransaction } from 'src/db/database';
import { ActivityImage, ActivityImageFile } from 'src/db/schema';
import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { ActivityImageRepository } from 'src/repositories/activity-image.repository';
import { ActivityRepository } from 'src/repositories/activity.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { DatabaseRepository } from 'src/repositories/database.repository';
import { JobRepository } from 'src/repositories/job.repository';
import { SocialRepository } from 'src/repositories/social.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { JobOf, UploadedFileData } from 'src/types';

const SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif']);
const MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heif: 'image/heif',
  avif: 'image/avif',
};
const THUMBNAIL_SIZE = 250;
const PREVIEW_SIZE = 1440;
const IMAGE_PROCESSING_VERSION = 1;

@Injectable()
export class ActivityImageService {
  constructor(
    private readonly images: ActivityImageRepository,
    private readonly activities: ActivityRepository,
    private readonly storage: StorageRepository,
    private readonly crypto: CryptoRepository,
    private readonly database: DatabaseRepository,
    private readonly jobs: JobRepository,
    private readonly logger: ConsoleLogger,
    private readonly socialRepository: SocialRepository,
  ) {
    this.logger.setContext(ActivityImageService.name);
  }

  async upload(activityId: string, file: UploadedFileData | undefined, caption: string | undefined, userId: string) {
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
    const checksum = this.crypto.xxHash(file.buffer);
    const existing = await this.images.getByUploadChecksum(activity.upload_id, checksum);
    if (existing) {
      return this.toDto(existing, await this.images.getFiles(existing.id));
    }

    const storagePath = this.storage.buildTemporaryPath(extname(file.originalname).toLowerCase() || '.bin');
    await this.storage.write(storagePath, file.buffer);
    const sortOrder = await this.images.nextSortOrder(activity.upload_id);
    const image = await this.database.withTransaction((trx) =>
      this.queueForUpload(
        activity.upload_id,
        [{ originalName: file.originalname, storagePath, checksum, caption: caption?.trim() || undefined, sortOrder }],
        trx,
      ).then(([created]) => created!),
    );

    return this.toDto(image, []);
  }

  async queueForUpload(
    uploadId: string,
    stages: {
      originalName: string;
      storagePath: string;
      checksum: string;
      caption?: string | null;
      sortOrder: number;
    }[],
    executor?: KondisTransaction,
  ): Promise<ActivityImage[]> {
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
    if (!activity || !(await this.socialRepository.canViewActivity(activityId, userId))) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const rows = await this.images.listForUpload(activity.upload_id);
    return Promise.all(
      rows
        .filter((row) => row.status === 'ready')
        .map(async (row) => this.toDto(row, await this.images.getFiles(row.id))),
    );
  }

  async update(
    activityId: string,
    imageId: string,
    input: { caption?: string | null; sortOrder?: number },
    userId: string,
  ) {
    const activity = await this.activities.getById(activityId, userId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityId} does not exist`);
    }
    const image = await this.images.getById(imageId, userId);
    if (!image || image.upload_id !== activity.upload_id) {
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
    if (!activity) {
      return false;
    }
    const image = await this.images.getById(imageId, userId);
    if (!image || image.upload_id !== activity.upload_id) {
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

  async getFile(
    imageId: string,
    variant: 'original' | 'thumbnail' | 'preview',
    userId: string,
  ): Promise<ActivityImageFile> {
    const image = await this.images.getById(imageId);
    if (!image) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const activity = await this.activities.getByUploadId(image.upload_id);
    if (!activity || !(await this.socialRepository.canViewActivity(activity.id, userId))) {
      throw new NotFoundException(`Image ${imageId} does not exist`);
    }
    const files = await this.images.getFiles(imageId);
    const file = files.find((item) => item.variant === variant);
    if (!file) {
      throw new NotFoundException(`Image ${imageId} variant ${variant} is not ready`);
    }
    return file;
  }

  absolutePath(path: string): string {
    return this.storage.absolutePath(path);
  }

  @OnJob({ name: JobName.ActivityImageIngest, queue: QueueName.ImageProcessing })
  async handleIngest({
    imageId,
    storagePath,
    originalName: _originalName,
    checksum,
  }: JobOf<JobName.ActivityImageIngest>): Promise<JobStatus> {
    const image = await this.images.getById(imageId);
    if (!image) {
      return JobStatus.Skipped;
    }
    try {
      const buffer = await this.storage.read(storagePath);
      if (this.crypto.xxHash(buffer) !== checksum) {
        throw new Error('Image upload checksum mismatch');
      }
      const metadata = await sharp(buffer, { limitInputPixels: UPLOAD_LIMITS.imagePixels }).metadata();
      const format = metadata.format ?? '';
      if (!SUPPORTED_FORMATS.has(format) || !metadata.width || !metadata.height) {
        throw new Error('Unsupported or invalid image');
      }
      const mimeType = MIME_TYPES[format];
      const extension = format === 'jpeg' ? '.jpg' : `.${format}`;
      const permanentPath = this.storage.buildImagePath(imageId, 'original', extension);
      await this.storage.write(permanentPath, buffer);
      await this.database.withTransaction(async (trx) => {
        await this.images.upsertFile(
          {
            image_id: imageId,
            variant: 'original',
            storage_path: permanentPath,
            mime_type: mimeType,
            byte_size: buffer.length,
            width: metadata.width!,
            height: metadata.height!,
          },
          trx,
        );
        await this.images.update(
          imageId,
          {
            mime_type: mimeType,
            byte_size: buffer.length,
            width: metadata.width,
            height: metadata.height,
            status: 'pending',
            error: null,
          },
          trx,
        );
        await this.jobs.queue(
          { name: JobName.ActivityImageGenerateThumbnails, data: { id: imageId } },
          { transaction: trx },
        );
      });
      return JobStatus.Success;
    } catch (error) {
      await this.images.update(imageId, {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  @OnJob({ name: JobName.ActivityImageAttach, queue: QueueName.ImageProcessing })
  async handleAttach({ uploadId, images }: JobOf<JobName.ActivityImageAttach>): Promise<JobStatus> {
    await this.queueForUpload(uploadId, images);
    return JobStatus.Success;
  }

  @OnJob({ name: JobName.ActivityImageGenerateThumbnails, queue: QueueName.ImageProcessing })
  async handleGenerateThumbnails({ id }: JobOf<JobName.ActivityImageGenerateThumbnails>): Promise<JobStatus> {
    const image = await this.images.getById(id);
    if (!image) {
      return JobStatus.Skipped;
    }
    const files = await this.images.getFiles(id);
    const original = files.find((file) => file.variant === 'original');
    if (!original) {
      return JobStatus.Skipped;
    }
    try {
      const input = this.storage.absolutePath(original.storage_path);
      const preview = await sharp(input)
        .rotate()
        .resize(PREVIEW_SIZE, PREVIEW_SIZE, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      const thumbnail = await sharp(input)
        .rotate()
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });
      const previewPath = this.storage.buildImagePath(id, 'preview', '.jpg');
      const thumbnailPath = this.storage.buildImagePath(id, 'thumbnail', '.webp');
      await Promise.all([
        this.storage.write(previewPath, preview.data),
        this.storage.write(thumbnailPath, thumbnail.data),
      ]);
      await this.database.withTransaction(async (trx) => {
        await this.images.upsertFile(
          {
            image_id: id,
            variant: 'preview',
            storage_path: previewPath,
            mime_type: 'image/jpeg',
            byte_size: preview.data.length,
            width: preview.info.width,
            height: preview.info.height,
          },
          trx,
        );
        await this.images.upsertFile(
          {
            image_id: id,
            variant: 'thumbnail',
            storage_path: thumbnailPath,
            mime_type: 'image/webp',
            byte_size: thumbnail.data.length,
            width: thumbnail.info.width,
            height: thumbnail.info.height,
          },
          trx,
        );
        await this.images.update(id, { status: 'ready', error: null }, trx);
      });
      return JobStatus.Success;
    } catch (error) {
      await this.images.update(id, { status: 'failed', error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  @OnJob({ name: JobName.ActivityImageGenerateQueueAll, queue: QueueName.BackgroundTask })
  async handleQueueAll({ force = false }: JobOf<JobName.ActivityImageGenerateQueueAll>): Promise<JobStatus> {
    const rows = await this.images.listForThumbnailGeneration(force);
    for (const row of rows) {
      await this.jobs.queue({ name: JobName.ActivityImageGenerateThumbnails, data: { id: row.id } });
    }
    return JobStatus.Success;
  }

  private toDto(image: ActivityImage, files: ActivityImageFile[]) {
    return {
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
    };
  }
}
