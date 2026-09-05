import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { JobName } from 'src/enum';
import { BadRequestException, NotFoundException, PayloadTooLargeException } from 'src/errors';
import type { JobProducerPort } from 'src/ports/queue.port';
import type { StoragePort } from 'src/ports/storage.port';
import { SocialRepository } from 'src/repositories/social.repository';
import { UserRepository } from 'src/repositories/user.repository';
import type { BufferedUploadedFileData } from 'src/types/uploads';

export class WorkerUserService {
  constructor(
    private readonly users: UserRepository,
    private readonly social: SocialRepository,
    private readonly storage: StoragePort,
    private readonly jobs: JobProducerPort,
  ) {}

  async updateProfile(userId: string, firstName: string, lastName: string) {
    await this.users.setNameParts(userId, firstName, lastName);
    const updated = await this.users.findById(userId);
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
    const storagePath = this.storage.buildTemporaryPath('.jpg');
    await this.storage.write(storagePath, file.buffer);
    try {
      await this.jobs.queue({ name: JobName.UserAvatarUpload, data: { userId, storagePath } });
    } catch (error) {
      await this.storage.delete(storagePath).catch(() => {});
      throw error;
    }
    return { avatarUrl: `/api/v1/users/${userId}/avatar`, queued: true };
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
    return this.storage.reference(path);
  }
}
