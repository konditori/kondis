import { mkdtemp, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { ConfigService } from 'src/config/config.service';
import { CryptoRepository } from 'src/repositories/crypto.repository';
import { StorageRepository } from 'src/repositories/storage.repository';

import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(StorageRepository.name, () => {
  let db: ReturnType<typeof createMediumTestDatabase>;
  let storageDir: string;

  beforeAll(async () => {
    db = createMediumTestDatabase();
    storageDir = await mkdtemp(join(tmpdir(), 'kondis-medium-storage-'));
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
    await rm(storageDir, { recursive: true, force: true });
  });

  const setup = () => ({ sut: new StorageRepository({ storageDir } as ConfigService, new CryptoRepository()) });

  it('writes, reads, and deletes files in the configured storage directory', async () => {
    const { sut } = setup();
    const path = sut.buildTemporaryPath('.fit');
    const contents = Buffer.from('repository storage test');

    await sut.write(path, contents);
    await expect(sut.read(path)).resolves.toEqual(contents);
    await sut.delete(path);
    await expect(sut.read(path)).rejects.toThrow();
  });

  it('deletes expired temporary files while preserving referenced files', async () => {
    const { sut } = setup();
    const expired = sut.buildTemporaryPath('.zip');
    const referenced = sut.buildTemporaryPath('.zip');
    await sut.write(expired, Buffer.from('expired'));
    await sut.write(referenced, Buffer.from('referenced'));
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await utimes(sut.absolutePath(expired), old, old);
    await utimes(sut.absolutePath(referenced), old, old);

    await expect(
      sut.deleteTemporaryFilesOlderThan(new Date(Date.now() - 24 * 60 * 60 * 1000), new Set([referenced])),
    ).resolves.toEqual([expired]);
    await expect(sut.read(referenced)).resolves.toEqual(Buffer.from('referenced'));
  });
});
