import { compare, hash } from 'bcrypt-ts/browser';

import { CryptoRepository } from 'src/contracts/crypto.repository';

const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export class WorkerCryptoRepository extends CryptoRepository {
  comparePassword(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  hashPassword(password: string, workFactor: number): Promise<string> {
    return hash(password, workFactor);
  }

  randomToken(byteLength: number): string {
    return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
  }

  safeEqual(left: string, right: string): boolean {
    return left === right;
  }

  async sha256(value: string | Uint8Array): Promise<string> {
    const bytes = Uint8Array.from(typeof value === 'string' ? new TextEncoder().encode(value) : value);
    return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  }

  uuid(): string {
    return crypto.randomUUID();
  }
}
