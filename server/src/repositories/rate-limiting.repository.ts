import { HttpException, HttpStatus } from 'src/errors';
import { Logger } from 'src/logger';

export type RateLimitOptions = {
  label: string;
  maxAttempts: number;
  windowMs: number;
};

export class RateLimitingRepository {
  private readonly logger = new Logger(RateLimitingRepository.name);
  private readonly attempts = new Map<string, number[]>();

  consume(clientId: string, options: RateLimitOptions, now = Date.now()): void {
    const recent = this.getRecentAttempts(clientId, now, options.windowMs);
    if (recent.length >= options.maxAttempts) {
      const retryAfterSeconds = Math.ceil((options.windowMs - (now - recent[0]!)) / 1000);
      this.logger.warn(
        `${options.label} rate limit exceeded for client ${clientId}; retry allowed in ${retryAfterSeconds} seconds`,
      );
      throw new HttpException(
        `Too many ${options.label.toLowerCase()} attempts. Try again in ${retryAfterSeconds} seconds.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.recordAttempt(clientId, now);
  }

  private getRecentAttempts(clientId: string, now: number, windowMs: number): number[] {
    const recent = (this.attempts.get(clientId) ?? []).filter((attempt) => now - attempt < windowMs);
    this.attempts.set(clientId, recent);
    return recent;
  }

  private recordAttempt(clientId: string, now: number): void {
    const attempts = this.attempts.get(clientId) ?? [];
    attempts.push(now);
    this.attempts.set(clientId, attempts);
  }
}
