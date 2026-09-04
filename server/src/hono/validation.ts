import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import type { z } from 'zod';

import type { HonoAuthEnv } from 'src/hono/auth';

const JSON_BODY_LIMIT_BYTES = 100 * 1024;
const jsonLimit = bodyLimit({
  maxSize: JSON_BODY_LIMIT_BYTES,
  onError: () => {
    throw new PayloadTooLargeException();
  },
});

export class RequestValidationError extends Error {
  constructor(readonly issues: z.core.$ZodIssue[]) {
    super('Validation failed');
  }
}

export const parseRequest = <Schema extends z.ZodType>(schema: Schema, input: unknown): z.infer<Schema> => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new RequestValidationError(result.error.issues);
  }
  return result.data;
};

export const jsonBodyMiddleware = createMiddleware<HonoAuthEnv>(async (context, next) => {
  const contentType = context.req.header('Content-Type') ?? '';
  if (!/^application\/([a-z-.]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new BadRequestException('Content-Type must be application/json');
  }

  return jsonLimit(context, async () => {
    try {
      await context.req.json();
    } catch {
      throw new BadRequestException('Request body is not valid JSON');
    }
    await next();
  });
});
