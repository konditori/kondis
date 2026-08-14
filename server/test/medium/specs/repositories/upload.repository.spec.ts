import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UploadRepository } from 'src/repositories/upload.repository';

import { createMediumFactory } from 'test/medium.factory';
import { createTestApp, type TestApp } from 'test/medium/test-app';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(UploadRepository.name, () => {
  let testApp: TestApp;
  let db: ReturnType<typeof createMediumTestDatabase>;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    testApp = await createTestApp();
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await testApp?.destroy();
    await db?.destroy();
  });

  const setup = () => ({ sut: testApp.get(UploadRepository), factory: createMediumFactory(testApp) });

  it('finds uploads by id and checksum and updates status', async () => {
    const { sut, factory } = setup();
    const user = await factory.newUser();
    const upload = await sut.create({
      checksum: 'a'.repeat(32),
      original_name: 'run.fit',
      byte_size: 42,
      storage_path: 'aa/aa/run.fit',
      user_id: user.id,
    });

    await expect(sut.getById(upload.id)).resolves.toMatchObject({ id: upload.id });
    await expect(sut.getByChecksum(upload.checksum, user.id)).resolves.toMatchObject({ id: upload.id });
    await sut.setStatus(upload.id, 'failed', 'parse failed');
    await expect(sut.getById(upload.id)).resolves.toMatchObject({ status: 'failed', error: 'parse failed' });
  });

  it('paginates uploads that still need parsing', async () => {
    const { sut } = setup();
    const first = await sut.create({ checksum: '1'.repeat(32), original_name: '1.fit', byte_size: 1, storage_path: '1/1.fit' });
    const second = await sut.create({ checksum: '2'.repeat(32), original_name: '2.fit', byte_size: 1, storage_path: '2/2.fit' });

    const ids = await sut.getIdsToParse({ force: false, limit: 10 });
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids).toHaveLength(2);
    await expect(sut.getIdsToParse({ force: false, after: ids[0], limit: 10 })).resolves.toEqual([ids[1]]);
  });
});
