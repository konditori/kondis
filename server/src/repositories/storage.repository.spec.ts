import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type ConfigRepository } from 'src/repositories/config.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { StorageRepository } from 'src/repositories/storage.repository';

describe('StorageRepository', () => {
  let storageDir: string;
  let repository: StorageRepository;

  beforeEach(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'kondis-storage-'));
    repository = new StorageRepository({ storageDir } as ConfigRepository, new CryptoRepository());
  });

  afterEach(async () => {
    await rm(storageDir, { recursive: true, force: true });
  });

  it('shards workout and image paths', () => {
    expect(repository.buildPath('user-id', 'abcdef0123456789', '.fit')).toBe(
      'activities/user-id/ab/cd/abcdef0123456789.fit',
    );
    expect(repository.buildImagePath('6ffe851c-920e-4615-844f-fcdfc40a8de7', 'original', '.jpg')).toBe(
      'images/6f/fe/6ffe851c-920e-4615-844f-fcdfc40a8de7/original.jpg',
    );
  });

  it('deletes only expired temporary files', async () => {
    const expired = repository.buildTemporaryPath('.zip');
    const referenced = repository.buildTemporaryPath('.zip');
    const current = repository.buildTemporaryPath('.zip');
    await repository.write(expired, Buffer.from('expired'));
    await repository.write(referenced, Buffer.from('referenced'));
    await repository.write(current, Buffer.from('current'));

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(repository.absolutePath(expired), twoDaysAgo, twoDaysAgo);
    await utimes(repository.absolutePath(referenced), twoDaysAgo, twoDaysAgo);

    await expect(
      repository.deleteTemporaryFilesOlderThan(new Date(Date.now() - 24 * 60 * 60 * 1000), new Set([referenced])),
    ).resolves.toEqual([expired]);
    await expect(repository.read(expired)).rejects.toThrow();
    await expect(repository.read(referenced)).resolves.toEqual(Buffer.from('referenced'));
    await expect(repository.read(current)).resolves.toEqual(Buffer.from('current'));
  });

  it('does nothing when the temporary directory does not exist', async () => {
    await expect(repository.deleteTemporaryFilesOlderThan(new Date())).resolves.toEqual([]);
  });
});
