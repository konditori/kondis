import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { JobName } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import { BaseService } from 'src/services/base.service';
import type { BufferedUploadedFileData } from 'src/types/uploads';

export class WorkerUserService extends BaseService {
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
    const storagePath = this.storageRepository.buildTemporaryPath('.jpg');
    await this.storageRepository.write(storagePath, file.buffer);
    try {
      await this.jobRepository.queue({ name: JobName.UserAvatarUpload, data: { userId, storagePath } });
    } catch (error) {
      await this.storageRepository.delete(storagePath).catch(() => {});
      throw error;
    }
    return { avatarUrl: `/api/v1/users/${userId}/avatar`, queued: true };
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
