import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import type { CryptoPort } from 'src/ports/crypto.port';
import type { StoragePort } from 'src/ports/storage.port';
import type { ImportProgressStore } from 'src/state/import-progress.store';
import { stageTakeoutPhoto } from 'src/utils/takeout-photo';

describe('stageTakeoutPhoto', () => {
  const importId = '00000000-0000-4000-8000-000000000002';
  const userId = '00000000-0000-4000-8000-000000000001';
  const metadata = { itemKey: 'activity:activities/run.fit', photoKey: 'photo:media/1.jpg', sortOrder: 0 };
  const buffer = Buffer.from('photo bytes');
  const file = { originalname: '1.JPG', buffer, size: buffer.length, path: '/tmp/upload' };

  const buildTemporaryPath = vi.fn(() => 'temporary/photo.jpg');
  const write = vi.fn(() => Promise.resolve());
  const deleteFile = vi.fn(() => Promise.resolve());
  const sha256 = vi.fn(() => Promise.resolve('c'.repeat(64)));
  const get = vi.fn();
  const stagePhoto = vi.fn();

  const storage = { buildTemporaryPath, write, delete: deleteFile } as unknown as StoragePort;
  const crypto = { sha256 } as unknown as CryptoPort;
  const progress = { get, stagePhoto } as unknown as ImportProgressStore;

  const stage = (photoMetadata: typeof metadata, photoFile: typeof file | undefined) =>
    stageTakeoutPhoto(progress, storage, crypto, importId, userId, photoMetadata, photoFile);
  const stageDefault = () => stageTakeoutPhoto(progress, storage, crypto, importId, userId, metadata, file);

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ status: 'uploading' });
    stagePhoto.mockResolvedValue(true);
  });

  it('rejects a missing photo before touching the import', async () => {
    await expect(stage(metadata, undefined)).rejects.toThrow('Missing photo upload');
    await expect(stage(metadata, { ...file, buffer: undefined as unknown as Buffer })).rejects.toThrow(
      'Missing photo upload',
    );
    expect(get).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('rejects a photo beyond the image size limit', async () => {
    const oversized = { ...file, buffer: Buffer.alloc(UPLOAD_LIMITS.imageFileBytes + 1) };

    await expect(stage(metadata, oversized)).rejects.toThrow('Photo exceeds the image size limit');
    expect(get).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['1.gif', '1.bmp', '1.txt', 'no-extension'])('rejects unsupported photo format %s', async (originalname) => {
    await expect(stage(metadata, { ...file, originalname })).rejects.toThrow('Unsupported photo format');
    expect(get).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it.each([undefined, { status: 'completed' }, { status: 'cancelled' }])(
    'declines terminal or unknown imports without writing: %o',
    async (owner) => {
      get.mockResolvedValue(owner);

      await expect(stageDefault()).resolves.toBe(false);
      expect(write).not.toHaveBeenCalled();
      expect(stagePhoto).not.toHaveBeenCalled();
    },
  );

  it('writes a bounded temporary object and stages it with a checksum', async () => {
    await expect(stage({ ...metadata, caption: 'Finish line' }, file)).resolves.toBe(true);

    expect(get).toHaveBeenCalledWith(importId, userId);
    expect(buildTemporaryPath).toHaveBeenCalledWith('.jpg');
    expect(write).toHaveBeenCalledWith('temporary/photo.jpg', buffer);
    expect(sha256).toHaveBeenCalledWith(buffer);
    expect(stagePhoto).toHaveBeenCalledWith(importId, userId, metadata.itemKey, {
      ...metadata,
      caption: 'Finish line',
      originalName: '1.JPG',
      storagePath: 'temporary/photo.jpg',
      checksum: 'c'.repeat(64),
    });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('removes the staged object when the store declines it', async () => {
    stagePhoto.mockResolvedValue(false);

    await expect(stageDefault()).resolves.toBe(false);
    expect(deleteFile).toHaveBeenCalledWith('temporary/photo.jpg');
  });

  it('removes the staged object when the store fails', async () => {
    stagePhoto.mockRejectedValue(new Error('database unavailable'));

    await expect(stageDefault()).rejects.toThrow('database unavailable');
    expect(deleteFile).toHaveBeenCalledWith('temporary/photo.jpg');
  });
});
