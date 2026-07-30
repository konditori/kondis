import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { ConfigService } from 'src/config/config.service';
import { CryptoRepository } from 'src/repositories/crypto.repository';

/**
 * Content-addressed file storage.
 *
 * Paths derive purely from the content hash, so ownership never appears in the filesystem
 * layout. That means introducing multi-user support later is a schema change only, with no
 * need to relocate files on every self-hosted install. It also makes storage naturally
 * deduplicating: identical bytes resolve to the same path.
 */
@Injectable()
export class StorageRepository {
  constructor(
    private readonly config: ConfigService,
    private readonly crypto: CryptoRepository,
  ) {}

  /** e.g. `ab/cd/abcd...ef.fit` — two levels of fan-out keeps directory sizes sane. */
  buildPath(checksum: string, extension: string): string {
    const suffix = extension.startsWith('.') ? extension : `.${extension}`;
    return join(checksum.slice(0, 2), checksum.slice(2, 4), `${checksum}${suffix}`);
  }

  absolutePath(relativePath: string): string {
    return resolve(this.config.storageDir, relativePath);
  }

  /**
   * Writes to a temporary file and renames into place, so a crash mid-write can never leave
   * a truncated file sitting at a path that claims to hold a specific hash.
   */
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
}
