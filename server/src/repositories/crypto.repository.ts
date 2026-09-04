import { xxh3 } from '@node-rs/xxhash';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import type { CryptoPort } from 'src/ports/crypto.port';

export class CryptoRepository implements CryptoPort {
  comparePassword(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  hashPassword(password: string, workFactor: number): Promise<string> {
    return hash(password, workFactor);
  }

  randomToken(byteLength: number): string {
    return randomBytes(byteLength).toString('base64url');
  }

  safeEqual(left: string, right: string): boolean {
    const leftBytes = Buffer.from(left);
    const rightBytes = Buffer.from(right);
    return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
  }

  sha256(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
  }

  xxHash(contents: Uint8Array): string {
    return xxh3.xxh128(contents).toString(16).padStart(32, '0');
  }

  uuid(): string {
    return randomUUID();
  }
}
