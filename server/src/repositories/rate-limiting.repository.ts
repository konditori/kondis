import { sql } from 'kysely';
import { HttpException, HttpStatus } from 'src/errors';
import { Logger } from 'src/logger';
import type { KondisDatabase } from 'src/types';

export type RateLimitOptions = {
  label: string;
  maxAttempts: number;
  windowMs: number;
};

export class RateLimitingRepository {
  private readonly logger = new Logger(RateLimitingRepository.name);

  constructor(private readonly db: KondisDatabase) {}

  async consume(clientId: string, options: RateLimitOptions, now = Date.now()): Promise<void> {
    const key = `${options.label}:${clientId}`;
    const windowStartedAt = new Date(now);
    const resetBefore = new Date(now - options.windowMs);
    const result = await sql<{ attempts: number; window_started_at: Date }>`
      INSERT INTO auth_rate_limit (key, attempts, window_started_at)
      VALUES (${key}, 1, ${windowStartedAt})
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE
          WHEN auth_rate_limit.window_started_at <= ${resetBefore} THEN 1
          ELSE auth_rate_limit.attempts + 1
        END,
        window_started_at = CASE
          WHEN auth_rate_limit.window_started_at <= ${resetBefore} THEN ${windowStartedAt}
          ELSE auth_rate_limit.window_started_at
        END
      RETURNING attempts, window_started_at
    `.execute(this.db);
    const attempt = result.rows[0]!;
    if (attempt.attempts <= options.maxAttempts) {
      return;
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((options.windowMs - (now - new Date(attempt.window_started_at).getTime())) / 1000),
    );
    this.logger.warn(
      `${options.label} rate limit exceeded for client ${clientId}; retry allowed in ${retryAfterSeconds} seconds`,
    );
    throw new HttpException(
      `Too many ${options.label.toLowerCase()} attempts. Try again in ${retryAfterSeconds} seconds.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
