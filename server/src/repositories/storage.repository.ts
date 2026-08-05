import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
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
    return join(checksum.slice(0, 2), checksum.slice(2, 4), `${checksum}${suffix}`);
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
}
