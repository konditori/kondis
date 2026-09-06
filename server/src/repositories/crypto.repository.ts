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

  sha256(value: string | Uint8Array): Promise<string> {
    return Promise.resolve(createHash('sha256').update(value).digest('hex'));
  }

  uuid(): string {
    return randomUUID();
  }
}
