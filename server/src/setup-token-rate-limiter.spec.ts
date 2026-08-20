import { HttpException, Logger } from '@nestjs/common';
import { SetupTokenRateLimiter } from 'src/setup-token-rate-limiter';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe(SetupTokenRateLimiter.name, () => {
  beforeEach(() => vi.restoreAllMocks());

  it('logs a warning when a client exceeds the setup-token limit', () => {
    const limiter = new SetupTokenRateLimiter();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    for (let attempt = 0; attempt < 5; attempt += 1) limiter.consume('client-1', 1_000);

    expect(() => limiter.consume('client-1', 1_000)).toThrow(HttpException);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Setup token rate limit exceeded'));
  });
});
