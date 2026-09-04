import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { FileSizeLimitError, type StoragePort } from 'src/ports/storage.port';
import { ConfigRepository } from 'src/repositories/config.repository';
import { CryptoRepository } from 'src/repositories/crypto.repository';

@Injectable()
export class StorageRepository implements StoragePort {
  constructor(
    private readonly config: ConfigRepository,
    private readonly crypto: CryptoRepository,
  ) {}

  buildPath(userId: string, checksum: string, extension: string): string {
    const suffix = extension.startsWith('.') ? extension : `.${extension}`;
    return join('activities', userId, checksum.slice(0, 2), checksum.slice(2, 4), `${checksum}${suffix}`);
  }

  buildTemporaryPath(extension: string): string {
    const suffix = extension.startsWith('.') ? extension : `.${extension}`;
    return join('temporary', `${this.crypto.uuid()}${suffix}`);
  }

  buildImagePath(imageId: string, variant: 'original' | 'thumbnail' | 'preview', extension: string): string {
    const suffix = extension.startsWith('.') ? extension : `.${extension}`;
    const shard = imageId.replaceAll('-', '');
    return join('images', shard.slice(0, 2), shard.slice(2, 4), imageId, `${variant}${suffix}`);
  }

  buildUserAvatarPath(userId: string): string {
    const shard = userId.replaceAll('-', '');
    return join('avatars', shard.slice(0, 2), shard.slice(2, 4), `${userId}.webp`);
  }

  absolutePath(relativePath: string): string {
    return resolve(this.config.storageDir, relativePath);
  }

  async write(relativePath: string, contents: Buffer): Promise<void> {
    const target = this.absolutePath(relativePath);
    await mkdir(dirname(target), { recursive: true });

    const temporary = `${target}.${this.crypto.uuid()}.tmp`;
    try {
      await writeFile(temporary, contents);
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  async importFile(sourcePath: string, relativePath: string): Promise<void> {
    const target = this.absolutePath(relativePath);
    await mkdir(dirname(target), { recursive: true });
    try {
      await rename(sourcePath, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }
      await copyFile(sourcePath, target);
      await rm(sourcePath, { force: true });
    }
  }

  async copy(sourcePath: string, targetPath: string): Promise<void> {
    const target = this.absolutePath(targetPath);
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${this.crypto.uuid()}.tmp`;
    try {
      await copyFile(this.absolutePath(sourcePath), temporary);
      await rename(temporary, target);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
  }

  read(relativePath: string): Promise<Buffer> {
    return readFile(this.absolutePath(relativePath));
  }

  async readLimited(relativePath: string, maximumBytes: number): Promise<Buffer> {
    const file = await open(this.absolutePath(relativePath), 'r');
    try {
      const metadata = await file.stat();
      if (metadata.size > maximumBytes) {
        throw new FileSizeLimitError(`File exceeds ${maximumBytes} bytes`);
      }

      const contents = Buffer.allocUnsafe(metadata.size + 1);
      let offset = 0;
      while (offset < contents.length) {
        const { bytesRead } = await file.read(contents, offset, contents.length - offset, offset);
        if (bytesRead === 0) {
          break;
        }
        offset += bytesRead;
      }
      if (offset > maximumBytes) {
        throw new FileSizeLimitError(`File exceeds ${maximumBytes} bytes`);
      }
      return contents.subarray(0, offset);
    } finally {
      await file.close();
    }
  }

  readStream(relativePath: string): AsyncIterable<Uint8Array> {
    return createReadStream(this.absolutePath(relativePath));
  }

  async size(relativePath: string): Promise<number> {
    const metadata = await stat(this.absolutePath(relativePath));
    return metadata.size;
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.absolutePath(relativePath), { force: true });
  }

  async deleteExternal(path: string): Promise<void> {
    await rm(path, { force: true });
  }

  async deleteTemporaryFilesOlderThan(
    cutoff: Date,
    protectedPaths: ReadonlySet<string> = new Set(),
  ): Promise<string[]> {
    const directory = this.absolutePath('temporary');
    let entries;

    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    const deleted: string[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const relativePath = join('temporary', entry.name);
      if (protectedPaths.has(relativePath)) {
        continue;
      }
      const metadata = await stat(this.absolutePath(relativePath));
      if (metadata.mtime > cutoff) {
        continue;
      }

      await this.delete(relativePath);
      deleted.push(relativePath);
    }

    return deleted;
  }
}
