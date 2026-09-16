import sharp from 'sharp';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { JobName, JobStatus } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import { BaseService } from 'src/services/base.service';
import type { JobOf } from 'src/types/jobs';
import type { BufferedUploadedFileData } from 'src/types/uploads';

const AVATAR_SIZE = 512;
const AVATAR_MIME_TYPE = 'image/webp';

export class UserService extends BaseService {
  async updateProfile(userId: string, firstName: string, lastName: string) {
    await this.userRepository.setNameParts(userId, firstName, lastName);
    const updated = await this.userRepository.findById(userId);
    if (!updated) {
      throw new NotFoundException('User does not exist');
    }
    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.first_name,
      lastName: updated.last_name,
      role: updated.role,
      avatarUrl: updated.avatar_path ? `/api/v1/users/${updated.id}/avatar` : null,
    };
  }

  async uploadAvatar(userId: string, file: BufferedUploadedFileData | undefined) {
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

    const path = this.storageRepository.buildUserAvatarPath(userId);
    const previous = await this.userRepository.getAvatar(userId);
    await this.storageRepository.write(path, image);
    await this.userRepository.setAvatar(userId, path, AVATAR_MIME_TYPE, image.length);
    if (previous?.avatar_path && previous.avatar_path !== path) {
      await this.storageRepository.delete(previous.avatar_path);
    }
    return { avatarUrl: `/api/v1/users/${userId}/avatar` };
  }

  async handleAvatarUpload({ userId, storagePath }: JobOf<JobName.UserAvatarUpload>): Promise<JobStatus> {
    if (!(await this.userRepository.findById(userId))) {
      return JobStatus.Skipped;
    }
    try {
      const buffer = await this.storageRepository.read(storagePath);
      await this.uploadAvatar(userId, { originalname: 'profile.jpg', buffer, size: buffer.length });
      return JobStatus.Success;
    } finally {
      await this.storageRepository.delete(storagePath);
    }
  }

  async clearAvatar(userId: string): Promise<void> {
    const previous = await this.userRepository.getAvatar(userId);
    if (!previous?.avatar_path) {
      return;
    }
    await this.userRepository.clearAvatar(userId);
    await this.storageRepository.delete(previous.avatar_path);
  }

  async avatarFile(userId: string, viewerId: string) {
    if (!(await this.socialRepository.canSeeProfile(viewerId, userId))) {
      throw new NotFoundException('Profile picture does not exist');
    }
    const avatar = await this.userRepository.getAvatar(userId);
    if (!avatar?.avatar_path || !avatar.avatar_mime_type || !avatar.avatar_size) {
      throw new NotFoundException('Profile picture does not exist');
    }
    return avatar;
  }

  avatarAbsolutePath(path: string): string {
    return this.storageRepository.reference(path);
  }
}
