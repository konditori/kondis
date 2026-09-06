import { hash } from 'bcrypt';
import { describe, expect, it } from 'vitest';

import { createCloudflareCryptoAdapter } from 'src/adapters/cloudflare/crypto.adapter';

describe('Cloudflare crypto adapter', () => {
  const sut = createCloudflareCryptoAdapter();

  it('emits bcrypt hashes in the persisted $2b$ format', async () => {
    const passwordHash = await sut.hashPassword('long enough password', 4);

    expect(passwordHash).toMatch(/^\$2b\$04\$[./A-Za-z0-9]{53}$/);
    await expect(sut.comparePassword('long enough password', passwordHash)).resolves.toBe(true);
    await expect(sut.comparePassword('wrong password', passwordHash)).resolves.toBe(false);
  });

  it('verifies hashes produced by the existing native bcrypt adapter', async () => {
    const passwordHash = await hash('long enough password', 4);

    await expect(sut.comparePassword('long enough password', passwordHash)).resolves.toBe(true);
    await expect(sut.comparePassword('wrong password', passwordHash)).resolves.toBe(false);
  });
});
