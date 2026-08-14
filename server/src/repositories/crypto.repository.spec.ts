import { describe, expect, it } from 'vitest';

import { CryptoRepository } from 'src/repositories/crypto.repository';

describe(CryptoRepository.name, () => {
  const sut = new CryptoRepository();

  it('returns a stable hexadecimal hash for identical contents', () => {
    expect(sut.xxHash(Buffer.from('same'))).toBe(sut.xxHash(Buffer.from('same')));
    expect(sut.xxHash(Buffer.from('same'))).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generates UUIDs', () => {
    expect(sut.uuid()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
