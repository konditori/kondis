import { HttpException, HttpStatus, Logger } from '@nestjs/common';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

/** Request-boundary limiter for setup-token guesses. Kept outside the service layer. */
export class SetupTokenRateLimiter {
  private readonly logger = new Logger(SetupTokenRateLimiter.name);
  private readonly attempts = new Map<string, number[]>();

  consume(clientId: string, now = Date.now()): void {
    const recent = (this.attempts.get(clientId) ?? []).filter((attempt) => now - attempt < WINDOW_MS);
    if (recent.length >= MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((WINDOW_MS - (now - recent[0]!)) / 1000);
      this.logger.warn(
        `Setup token rate limit exceeded for client ${clientId}; retry allowed in ${retryAfterSeconds} seconds`,
      );
      throw new HttpException(
        `Too many setup token attempts. Try again in ${retryAfterSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.attempts.set(clientId, recent);
  }
}
