import { BadRequestException, Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import sharp from 'sharp';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { OnJob } from 'src/decorators';
import { JobName, JobStatus, QueueName } from 'src/enum';
import { SocialRepository } from 'src/repositories/social.repository';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UserRepository } from 'src/repositories/user.repository';
import type { JobOf } from 'src/types/jobs';
import type { UploadedFileData } from 'src/types/uploads';

const AVATAR_SIZE = 512;
const AVATAR_MIME_TYPE = 'image/webp';

@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly social: SocialRepository,
    private readonly storage: StorageRepository,
  ) {}

  async uploadAvatar(userId: string, file: UploadedFileData | undefined) {
    if (!file) {
      throw new BadRequestException('Missing profile picture');
    }
    if (file.buffer.length > UPLOAD_LIMITS.avatarFileBytes) {
      throw new PayloadTooLargeException(`Profile picture exceeds ${UPLOAD_LIMITS.avatarFileBytes} bytes`);
    }

    let image: Buffer;
    try {
      image = await sharp(file.buffer, { limitInputPixels: UPLOAD_LIMITS.imagePixels })
        .rotate()
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
        .webp({ quality: 86 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Profile picture is not a supported image');
    }

    const path = this.storage.buildUserAvatarPath(userId);
    const previous = await this.users.getAvatar(userId);
    await this.storage.write(path, image);
    await this.users.setAvatar(userId, path, AVATAR_MIME_TYPE, image.length);
    if (previous?.avatar_path && previous.avatar_path !== path) {
      await this.storage.delete(previous.avatar_path);
    }
    return { avatarUrl: `/api/v1/users/${userId}/avatar` };
  }

  @OnJob({ name: JobName.UserAvatarUpload, queue: QueueName.ImageProcessing })
  async handleAvatarUpload({ userId, storagePath }: JobOf<JobName.UserAvatarUpload>): Promise<JobStatus> {
    if (!(await this.users.findById(userId))) {
      return JobStatus.Skipped;
    }
    try {
      const buffer = await this.storage.read(storagePath);
      await this.uploadAvatar(userId, { originalname: 'profile.jpg', buffer, size: buffer.length });
      return JobStatus.Success;
    } finally {
      await this.storage.delete(storagePath);
    }
  }

  async clearAvatar(userId: string): Promise<void> {
    const previous = await this.users.getAvatar(userId);
    if (!previous?.avatar_path) {
      return;
    }
    await this.users.clearAvatar(userId);
    await this.storage.delete(previous.avatar_path);
  }

  async avatarFile(userId: string, viewerId: string) {
    if (!(await this.social.canSeeProfile(viewerId, userId))) {
      throw new NotFoundException('Profile picture does not exist');
    }
    const avatar = await this.users.getAvatar(userId);
    if (!avatar?.avatar_path || !avatar.avatar_mime_type || !avatar.avatar_size) {
      throw new NotFoundException('Profile picture does not exist');
    }
    return avatar;
  }

  avatarAbsolutePath(path: string): string {
    return this.storage.absolutePath(path);
  }
}
