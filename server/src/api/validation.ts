import { createMiddleware } from 'hono/factory';
import type { z } from 'zod';

import type { ApiEnv } from 'src/api/auth';
import { BadRequestException, PayloadTooLargeException } from 'src/errors';

const JSON_BODY_LIMIT_BYTES = 100 * 1024;
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

export const jsonBodyMiddleware = createMiddleware<ApiEnv>(async (context, next) => {
  const contentType = context.req.header('Content-Type') ?? '';
  if (!/^application\/([a-z-.]+\+)?json(?:\s*;|$)/i.test(contentType)) {
    throw new BadRequestException('Content-Type must be application/json');
  }

  const contentLength = context.req.header('Content-Length');
  if (contentLength !== undefined && Number(contentLength) > JSON_BODY_LIMIT_BYTES) {
    throw new PayloadTooLargeException();
  }

  if (contentLength === undefined) {
    const reader = context.req.raw.clone().body?.getReader();
    if (reader) {
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        size += value.byteLength;
        if (size > JSON_BODY_LIMIT_BYTES) {
          void reader.cancel();
          throw new PayloadTooLargeException();
        }
      }
    }
  }

  try {
    await context.req.json();
  } catch {
    throw new BadRequestException('Request body is not valid JSON');
  }
  await next();
});
