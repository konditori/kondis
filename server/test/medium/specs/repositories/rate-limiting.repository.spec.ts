import { describe, expect, it } from 'vitest';

import { HttpException, HttpStatus } from 'src/errors';
import { RateLimitingRepository } from 'src/repositories/rate-limiting.repository';

describe(RateLimitingRepository.name, () => {
  const options = { label: 'Setup token', maxAttempts: 5, windowMs: 60_000 } as const;

  it('allows the configured attempts and rejects the next one', () => {
    const sut = new RateLimitingRepository();

    for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
      expect(() => sut.consume('client-1', options, 1000)).not.toThrow();
    }

    expect(() => sut.consume('client-1', options, 1000)).toThrow(HttpException);
    try {
      sut.consume('client-1', options, 1000);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((error as HttpException).getResponse()).toContain('Try again in 60 seconds.');
    }
  });

  it('keeps quotas separate for different clients', () => {
    const sut = new RateLimitingRepository();

    for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
      sut.consume('client-1', options, 1000);
    }

    expect(() => sut.consume('client-2', options, 1000)).not.toThrow();
    expect(() => sut.consume('client-1', options, 1000)).toThrow(HttpException);
  });

  it('allows attempts again after the configured window expires', () => {
    const sut = new RateLimitingRepository();

    for (let attempt = 0; attempt < options.maxAttempts; attempt += 1) {
      sut.consume('client-1', options, 1000);
    }
    expect(() => sut.consume('client-1', options, 1000)).toThrow(HttpException);

    expect(() => sut.consume('client-1', options, 61_000)).not.toThrow();
  });
});
