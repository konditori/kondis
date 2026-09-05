import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { HttpException, HttpStatus } from 'src/errors';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';
import type { KondisDatabase } from 'src/types';
import { createMediumTestDatabase, resetMediumTestDatabase } from 'test/medium/test-db';

describe(RateLimitingRepository.name, () => {
  const options = { label: 'Setup token', maxAttempts: 5, windowMs: 60_000 } as const;
  let db: KondisDatabase;
  let sut: RateLimitingRepository;

  beforeAll(() => {
    db = createMediumTestDatabase();
    sut = new RateLimitingRepository(db);
  });
  beforeEach(() => resetMediumTestDatabase(db));
  afterAll(async () => {
    await db?.destroy();
  });

  it('allows the configured attempts and rejects the next one', async () => {
    for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
      await expect(sut.consume('client-1', options, 1000)).resolves.toBeUndefined();
    }

    await expect(sut.consume('client-1', options, 1000)).rejects.toBeInstanceOf(HttpException);
    try {
      await sut.consume('client-1', options, 1000);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((error as HttpException).getResponse()).toContain('Try again in 60 seconds.');
    }
  });

  it('keeps quotas separate for different clients', async () => {
    for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
      await sut.consume('client-1', options, 1000);
    }

    await expect(sut.consume('client-2', options, 1000)).resolves.toBeUndefined();
    await expect(sut.consume('client-1', options, 1000)).rejects.toBeInstanceOf(HttpException);
  });

  it('allows attempts again after the configured window expires', async () => {
    for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
      await sut.consume('client-1', options, 1000);
    }
    await expect(sut.consume('client-1', options, 1000)).rejects.toBeInstanceOf(HttpException);

    await expect(sut.consume('client-1', options, 61_000)).resolves.toBeUndefined();
  });
});
