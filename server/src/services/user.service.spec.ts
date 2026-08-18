import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { JobStatus } from 'src/enum';
import type { SocialRepository } from 'src/repositories/social.repository';
import type { StorageRepository } from 'src/repositories/storage.repository';
import type { UserRepository } from 'src/repositories/user.repository';
import { UserService } from 'src/services/user.service';
import { newTestService } from 'test/utils';

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const setup = () => {
  const mocks = {
    users: {
      findById: vi.fn(),
      getAvatar: vi.fn(),
      setAvatar: vi.fn(),
      clearAvatar: vi.fn(),
    } as unknown as UserRepository,
    social: { canSeeProfile: vi.fn() } as unknown as SocialRepository,
    storage: {
      buildUserAvatarPath: vi.fn(() => 'avatars/user-1.webp'),
      write: vi.fn(),
      read: vi.fn(),
      delete: vi.fn(),
      absolutePath: vi.fn((path: string) => `/storage/${path}`),
    } as unknown as StorageRepository,
  };
  return newTestService(UserService, [mocks.users, mocks.social, mocks.storage], mocks);
};

describe(UserService.name, () => {
  it('converts and stores a profile picture', async () => {
    const { sut, mocks } = setup();
    vi.mocked(mocks.users.getAvatar).mockResolvedValue({ avatar_path: null } as never);

    await expect(
      sut.uploadAvatar('user-1', { originalname: 'profile.jpg', buffer: image, size: image.length }),
    ).resolves.toEqual({
      avatarUrl: '/api/v1/users/user-1/avatar',
    });

    const storedImage = vi.mocked(mocks.storage.write).mock.calls[0]?.[1];
    expect(storedImage).toBeInstanceOf(Buffer);
    expect(storedImage?.equals(image)).toBe(false);
    expect(mocks.users.setAvatar).toHaveBeenCalledWith(
      'user-1',
      'avatars/user-1.webp',
      'image/webp',
      storedImage!.length,
    );
  });

  it('processes a staged avatar through the queue handler and removes the temporary file', async () => {
    const { sut, mocks } = setup();
    vi.mocked(mocks.users.findById).mockResolvedValue({ id: 'user-1' } as never);
    vi.mocked(mocks.users.getAvatar).mockResolvedValue({ avatar_path: null } as never);
    vi.mocked(mocks.storage.read).mockResolvedValue(image);

    await expect(sut.handleAvatarUpload({ userId: 'user-1', storagePath: 'temporary/profile.jpg' })).resolves.toBe(
      JobStatus.Success,
    );

    expect(mocks.storage.delete).toHaveBeenCalledWith('temporary/profile.jpg');
  });

  it('skips a queued avatar when its user no longer exists', async () => {
    const { sut, mocks } = setup();
    vi.mocked(mocks.users.findById).mockResolvedValue(undefined);

    await expect(sut.handleAvatarUpload({ userId: 'missing', storagePath: 'temporary/profile.jpg' })).resolves.toBe(
      JobStatus.Skipped,
    );
    expect(mocks.storage.read).not.toHaveBeenCalled();
  });

  it('removes an avatar and enforces profile visibility', async () => {
    const { sut, mocks } = setup();
    vi.mocked(mocks.users.getAvatar).mockResolvedValue({ avatar_path: 'avatars/user-1.webp' } as never);
    vi.mocked(mocks.social.canSeeProfile).mockResolvedValue(false);

    await sut.clearAvatar('user-1');
    expect(mocks.users.clearAvatar).toHaveBeenCalledWith('user-1');
    expect(mocks.storage.delete).toHaveBeenCalledWith('avatars/user-1.webp');
    await expect(sut.avatarFile('user-1', 'viewer-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
