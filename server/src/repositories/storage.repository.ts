import { Injectable } from '@nestjs/common';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { ConfigService } from 'src/config/config.service';
import { CryptoRepository } from 'src/repositories/crypto.repository';

@Injectable()
export class StorageRepository {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoRepository,
  ) {}

  buildPath(checksum: string, extension: string): string {
    const suffix = extension.startsWith('.') ? extension : `.${extension}`;
    return join('activities', checksum.slice(0, 2), checksum.slice(2, 4), `${checksum}${suffix}`);
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

  read(relativePath: string): Promise<Buffer> {
    return readFile(this.absolutePath(relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.absolutePath(relativePath), { force: true });
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
