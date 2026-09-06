import { describe, expect, it, vi } from 'vitest';

import { R2StorageAdapter, type R2BucketBinding } from 'src/adapters/cloudflare/storage.adapter';

const makeBucket = () => {
  const values = new Map<string, Uint8Array>();
  const uploaded = new Map<string, Date>();
  const bucket: R2BucketBinding = {
    delete: vi.fn((key: string) => {
      values.delete(key);
      uploaded.delete(key);
      return Promise.resolve();
    }),
    get: vi.fn((key: string, options?: { range?: { offset: number; length: number } }) => {
      const value = values.get(key);
      if (!value) {
        return Promise.resolve(null);
      }
      const body = options?.range
        ? value.slice(options.range.offset, options.range.offset + options.range.length)
        : value;
      return Promise.resolve({
        body: new Response(body as unknown as BodyInit).body,
        size: value.length,
        uploaded: uploaded.get(key)!,
      });
    }),
    list: vi.fn(() => {
      const objects: Array<{ key: string; uploaded: Date }> = [];
      values.forEach((_value, key) => {
        objects.push({ key, uploaded: uploaded.get(key)! });
      });
      return Promise.resolve({ objects, truncated: false });
    }),
    put: vi.fn((key: string, value: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>) => {
      if (value instanceof ReadableStream) {
        return Promise.reject(new Error('stream fixtures are not supported'));
      }
      values.set(key, value instanceof Uint8Array ? value : new Uint8Array(value));
      uploaded.set(key, new Date('2026-09-06T12:00:00Z'));
      return Promise.resolve();
    }),
  };
  return { bucket, values, uploaded };
};

describe('R2StorageAdapter', () => {
  it('uses stable object keys and supports reads, writes, and ranges', async () => {
    const { bucket } = makeBucket();
    const storage = new R2StorageAdapter(bucket, () => 'temporary-id');
    const path = storage.buildTemporaryPath('.fit');

    expect(path).toBe('temporary/temporary-id.fit');
    await storage.write(path, Buffer.from('abcdef'));
    const contents = await storage.read(path);
    expect([...contents]).toEqual([97, 98, 99, 100, 101, 102]);

    const file = await storage.open(path);
    expect(file.size).toBe(6);
    await expect(new Response(await file.streamAsync?.({ start: 1, end: 3 })).text()).resolves.toBe('bcd');
  });

  it('deletes only expired unreferenced temporary objects', async () => {
    const { bucket, values, uploaded } = makeBucket();
    const storage = new R2StorageAdapter(bucket, () => 'id');
    values.set('temporary/expired.fit', new Uint8Array([1]));
    values.set('temporary/keep.fit', new Uint8Array([2]));
    uploaded.set('temporary/expired.fit', new Date('2026-09-01T00:00:00Z'));
    uploaded.set('temporary/keep.fit', new Date('2026-09-01T00:00:00Z'));

    await expect(
      storage.deleteTemporaryFilesOlderThan(new Date('2026-09-05T00:00:00Z'), new Set(['temporary/keep.fit'])),
    ).resolves.toEqual(['temporary/expired.fit']);
    expect(values.has('temporary/expired.fit')).toBe(false);
    expect(values.has('temporary/keep.fit')).toBe(true);
  });
});
