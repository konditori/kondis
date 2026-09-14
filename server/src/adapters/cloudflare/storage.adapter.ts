import type { FileReader } from 'src/api/file-response';
import { FileSizeLimitError, type StorageFile, type StoragePort } from 'src/ports/storage.port';

export type R2ObjectRange = { offset: number; length: number };
export type R2ObjectLike = {
  body: ReadableStream<Uint8Array> | null;
  size: number;
  uploaded: Date;
};
export type R2BucketBinding = {
  delete: (key: string) => Promise<void>;
  get: (key: string, options?: { range?: R2ObjectRange }) => Promise<R2ObjectLike | null>;
  list: (options?: { prefix?: string; cursor?: string; limit?: number }) => Promise<{
    objects: Array<{ key: string; uploaded: Date }>;
    truncated: boolean;
    cursor?: string;
  }>;
  put: (key: string, value: Uint8Array | ArrayBuffer | ReadableStream<Uint8Array>) => Promise<unknown>;
};

const joinPath = (...parts: string[]): string => parts.join('/').split('/').filter(Boolean).join('/');

const toUint8Array = async (object: R2ObjectLike): Promise<Uint8Array> => {
  if (!object.body) {
    return new Uint8Array();
  }
  return new Uint8Array(await new Response(object.body).arrayBuffer());
};

export class R2StorageAdapter implements StoragePort {
  constructor(
    private readonly bucket: R2BucketBinding,
    private readonly uuid: () => string = () => crypto.randomUUID(),
  ) {}

  buildPath(userId: string, checksum: string, extension: string): string {
    return joinPath(
      'activities',
      userId,
      checksum.slice(0, 2),
      checksum.slice(2, 4),
      `${checksum}${this.suffix(extension)}`,
    );
  }

  buildTemporaryPath(extension: string): string {
    return joinPath('temporary', `${this.uuid()}${this.suffix(extension)}`);
  }

  buildUserAvatarPath(userId: string): string {
    const shard = userId.replaceAll('-', '');
    return joinPath('avatars', shard.slice(0, 2), shard.slice(2, 4), `${userId}.webp`);
  }

  buildImagePath(imageId: string, variant: 'original' | 'thumbnail' | 'preview', extension: string): string {
    const shard = imageId.replaceAll('-', '');
    return joinPath('images', shard.slice(0, 2), shard.slice(2, 4), imageId, `${variant}${this.suffix(extension)}`);
  }

  reference(relativePath: string): string {
    return relativePath;
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const object = await this.required(sourcePath);
    await this.bucket.put(targetPath, await toUint8Array(object));
  }

  delete(relativePath: string): Promise<void> {
    return this.bucket.delete(relativePath);
  }

  async deleteTemporaryFilesOlderThan(
    cutoff: Date,
    protectedPaths: ReadonlySet<string> = new Set(),
  ): Promise<string[]> {
    const deleted: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.bucket.list({ prefix: 'temporary/', cursor, limit: 1000 });
      for (const object of page.objects) {
        if (protectedPaths.has(object.key) || object.uploaded > cutoff) {
          continue;
        }
        await this.bucket.delete(object.key);
        deleted.push(object.key);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return deleted;
  }

  async open(relativePath: string): Promise<StorageFile> {
    const object = await this.required(relativePath);
    return {
      size: object.size,
      lastModified: object.uploaded,
      stream: () => object.body ?? new Uint8Array(),
      streamAsync: async (range) => {
        const response = await this.bucket.get(relativePath, {
          ...(range && { range: { offset: range.start, length: range.end - range.start + 1 } }),
        });
        return response?.body ?? new Uint8Array();
      },
      close: () => Promise.resolve(),
    };
  }

  async read(relativePath: string): Promise<Buffer> {
    return Buffer.from(await toUint8Array(await this.required(relativePath)));
  }

  async readLimited(relativePath: string, maximumBytes: number): Promise<Buffer> {
    const object = await this.required(relativePath);
    if (object.size > maximumBytes) {
      throw new FileSizeLimitError(`File exceeds ${maximumBytes} bytes`);
    }
    return Buffer.from(await toUint8Array(object));
  }

  async write(relativePath: string, contents: Buffer): Promise<void> {
    await this.bucket.put(relativePath, contents);
  }

  private suffix(extension: string): string {
    return extension.startsWith('.') ? extension : `.${extension}`;
  }

  private async required(key: string): Promise<R2ObjectLike> {
    const object = await this.bucket.get(key);
    if (!object) {
      const error = new Error(`Object ${key} does not exist`);
      Object.assign(error, { code: 'ENOENT' });
      throw error;
    }
    return object;
  }
}

export const createWorkerFileReader = (storage: Pick<StoragePort, 'open'>): FileReader => ({
  open: (path) => storage.open(path),
});
