export enum HttpStatus {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  PAYLOAD_TOO_LARGE = 413,
  TOO_MANY_REQUESTS = 429,
  NOT_IMPLEMENTED = 501,
  INTERNAL_SERVER_ERROR = 500,
}

export type HttpExceptionOptions = {
  cause?: unknown;
};

export type HttpExceptionResponse = string | Record<string, unknown>;

export class HttpException extends Error {
  constructor(
    private readonly response: HttpExceptionResponse,
    private readonly status: number,
    options?: HttpExceptionOptions,
  ) {
    const message =
      typeof response === 'string'
        ? response
        : typeof response.message === 'string'
          ? response.message
          : 'HTTP Exception';
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
  }

  getResponse(): HttpExceptionResponse {
    return this.response;
  }

  getStatus(): number {
    return this.status;
  }
}

type DescriptionOrOptions = string | HttpExceptionOptions;

const namedResponse = (
  response: string | Record<string, unknown> | undefined,
  statusCode: number,
  description: string,
): Record<string, unknown> => {
  if (response === undefined) {
    return { message: description, statusCode };
  }
  if (typeof response === 'string') {
    return { message: response, error: description, statusCode };
  }
  return response;
};

const descriptionAndOptions = (value: DescriptionOrOptions | undefined, fallback: string) => ({
  description: typeof value === 'string' ? value : fallback,
  options: typeof value === 'string' ? undefined : value,
});

export class BadRequestException extends HttpException {
  constructor(response?: string | Record<string, unknown>, descriptionOrOptions?: DescriptionOrOptions) {
    const { description, options } = descriptionAndOptions(descriptionOrOptions, 'Bad Request');
    super(namedResponse(response, HttpStatus.BAD_REQUEST, description), HttpStatus.BAD_REQUEST, options);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(response?: string | Record<string, unknown>, descriptionOrOptions?: DescriptionOrOptions) {
    const { description, options } = descriptionAndOptions(descriptionOrOptions, 'Unauthorized');
    super(namedResponse(response, HttpStatus.UNAUTHORIZED, description), HttpStatus.UNAUTHORIZED, options);
  }
}

export class ForbiddenException extends HttpException {
  constructor(response?: string | Record<string, unknown>, descriptionOrOptions?: DescriptionOrOptions) {
    const { description, options } = descriptionAndOptions(descriptionOrOptions, 'Forbidden');
    super(namedResponse(response, HttpStatus.FORBIDDEN, description), HttpStatus.FORBIDDEN, options);
  }
}

export class NotFoundException extends HttpException {
  constructor(response?: string | Record<string, unknown>, descriptionOrOptions?: DescriptionOrOptions) {
    const { description, options } = descriptionAndOptions(descriptionOrOptions, 'Not Found');
    super(namedResponse(response, HttpStatus.NOT_FOUND, description), HttpStatus.NOT_FOUND, options);
  }
}

export class ConflictException extends HttpException {
  constructor(response?: string | Record<string, unknown>, descriptionOrOptions?: DescriptionOrOptions) {
    const { description, options } = descriptionAndOptions(descriptionOrOptions, 'Conflict');
    super(namedResponse(response, HttpStatus.CONFLICT, description), HttpStatus.CONFLICT, options);
  }
}

export class PayloadTooLargeException extends HttpException {
  constructor(response?: string | Record<string, unknown>, descriptionOrOptions?: DescriptionOrOptions) {
    const { description, options } = descriptionAndOptions(descriptionOrOptions, 'Payload Too Large');
    super(namedResponse(response, HttpStatus.PAYLOAD_TOO_LARGE, description), HttpStatus.PAYLOAD_TOO_LARGE, options);
  }
}

export class UnsupportedOperationError extends HttpException {
  constructor(response = 'This operation is not supported by the current backend') {
    super(namedResponse(response, HttpStatus.NOT_IMPLEMENTED, 'Not Implemented'), HttpStatus.NOT_IMPLEMENTED);
  }
}
