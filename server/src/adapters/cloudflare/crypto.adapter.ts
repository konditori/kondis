import { compare, hash } from 'bcrypt-ts/browser';

import type { CryptoPort } from 'src/ports/crypto.port';

const bytesToBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCodePoint(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

/**
 * Crypto adapter for the Worker runtime.
 */
export const createCloudflareCryptoAdapter = (): CryptoPort => ({
  comparePassword: compare,
  hashPassword: hash,
  randomToken: (byteLength) => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength))),
  safeEqual: (left, right) => left === right,
  sha256: async (value) => {
    const bytes = Uint8Array.from(typeof value === 'string' ? new TextEncoder().encode(value) : value);
    return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
  },
  uuid: () => crypto.randomUUID(),
});
