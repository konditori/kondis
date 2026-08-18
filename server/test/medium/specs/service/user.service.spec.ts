import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { JobStatus } from 'src/enum';
import { StorageRepository } from 'src/repositories/storage.repository';
import { UserRepository } from 'src/repositories/user.repository';
import { UserService } from 'src/services/user.service';

import { createMediumFactory } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

describe(UserService.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;
  let testApp: TestApp;
  let users: UserRepository;
  let storage: StorageRepository;
  let sut: UserService;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();
    users = testApp.get(UserRepository);
    storage = testApp.get(StorageRepository);
    sut = testApp.get(UserService);
  });

  beforeEach(async () => {
    await resetMediumTestDatabase(db);
  });

  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  it('processes a staged profile picture for a user', async () => {
    const user = await createMediumFactory(db).newUser();
    const storagePath = storage.buildTemporaryPath('.jpg');
    await storage.write(storagePath, image);

    await expect(sut.handleAvatarUpload({ userId: user.id, storagePath })).resolves.toBe(JobStatus.Success);

    const storedUser = await users.findById(user.id);
    expect(storedUser).toMatchObject({
      avatar_mime_type: 'image/webp',
      avatar_size: expect.any(Number),
      avatar_path: expect.stringMatching(/^avatars\/.*\.webp$/),
    });
    await expect(storage.read(storagePath)).rejects.toThrow();
    await expect(storage.read(storedUser!.avatar_path!)).resolves.toHaveLength(storedUser!.avatar_size!);
  });
});
