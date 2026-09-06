import { describe, expect, it } from 'vitest';

import { CryptoRepository } from 'src/repositories/crypto.repository';

describe(CryptoRepository.name, () => {
  const sut = new CryptoRepository();

  it('returns a stable SHA-256 hash for identical contents', async () => {
    const expected = '0967115f2813a3541eaef77de9d9d5773f1c0c04314b0bbfe4ff3b3b1c55b5d5';

    await expect(sut.sha256('same')).resolves.toBe(expected);
    await expect(sut.sha256(Buffer.from('same'))).resolves.toBe(expected);
  });

  it('generates UUIDs', () => {
    expect(sut.uuid()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
