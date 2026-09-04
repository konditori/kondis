import { describe, expect, it } from 'vitest';

import { BadRequestException, HttpException, HttpStatus } from 'src/errors';

describe('HTTP exceptions', () => {
  it('preserves raw HttpException string responses', () => {
    const error = new HttpException('Try again later', HttpStatus.TOO_MANY_REQUESTS);

    expect(error).toBeInstanceOf(Error);
    expect(error.getStatus()).toBe(429);
    expect(error.getResponse()).toBe('Try again later');
  });

  it('creates Nest-compatible named exception responses', () => {
    const error = new BadRequestException('Invalid request');

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual({ message: 'Invalid request', error: 'Bad Request', statusCode: 400 });
  });
});
