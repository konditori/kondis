import { NotFoundException } from 'src/errors';

export type FileRange = { start: number; end: number };
export type OpenFile = {
  size: number;
  lastModified: Date;
  stream: (range?: FileRange, signal?: AbortSignal) => BodyInit;
  close: () => Promise<void>;
};
export type FileReader = {
  open: (path: string) => Promise<OpenFile>;
};

type FileResponseOptions = {
  headers: HeadersInit;
  missingMessage: string;
};

const isMissingFileError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return error.code === 'ENOENT' || error.code === 'ENOTDIR';
};

const parseRange = (value: string | null, size: number): FileRange | 'unsatisfiable' | undefined => {
  if (!value) {
    return undefined;
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || (!match[1] && !match[2])) {
    return undefined;
  }
  if (size === 0) {
    return 'unsatisfiable';
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (suffixLength === 0) {
      return 'unsatisfiable';
    }
    return {
      start: Number.isSafeInteger(suffixLength) && suffixLength < size ? size - suffixLength : 0,
      end: size - 1,
    };
  }

  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start >= size) {
    return 'unsatisfiable';
  }
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (requestedEnd < start) {
    return 'unsatisfiable';
  }
  const end = Number.isSafeInteger(requestedEnd) ? Math.min(requestedEnd, size - 1) : size - 1;
  return { start, end };
};

const notModified = (request: Request, lastModified: Date): boolean => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return false;
  }
  const value = request.headers.get('If-Modified-Since');
  if (!value) {
    return false;
  }
  const since = Date.parse(value);
  return !Number.isNaN(since) && Math.floor(lastModified.getTime() / 1000) <= Math.floor(since / 1000);
};

const ifRangeMatches = (request: Request, lastModified: Date): boolean => {
  const value = request.headers.get('If-Range');
  if (!value) {
    return true;
  }
  const date = Date.parse(value);
  return !Number.isNaN(date) && Math.floor(lastModified.getTime() / 1000) <= Math.floor(date / 1000);
};

export const fileResponse = async (
  request: Request,
  files: FileReader,
  path: string,
  options: FileResponseOptions,
): Promise<Response> => {
  request.signal.throwIfAborted();

  let file: OpenFile;
  try {
    file = await files.open(path);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new NotFoundException(options.missingMessage);
    }
    throw error;
  }

  let closeFile = true;
  try {
    request.signal.throwIfAborted();

    const headers = new Headers(options.headers);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Last-Modified', file.lastModified.toUTCString());
    if (notModified(request, file.lastModified)) {
      return new Response(null, { status: 304, headers });
    }

    const range =
      request.method === 'GET' && ifRangeMatches(request, file.lastModified)
        ? parseRange(request.headers.get('Range'), file.size)
        : undefined;
    if (range === 'unsatisfiable') {
      headers.set('Content-Range', `bytes */${file.size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }

    const status = range ? 206 : 200;
    if (range) {
      headers.set('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
      headers.set('Content-Length', String(range.end - range.start + 1));
    } else {
      headers.set('Content-Length', String(file.size));
    }
    if (request.method !== 'GET' || file.size === 0) {
      return new Response(null, { status, headers });
    }

    const body = file.stream(range, request.signal);
    const response = new Response(body, { status, headers });
    closeFile = false;
    return response;
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new NotFoundException(options.missingMessage);
    }
    throw error;
  } finally {
    if (closeFile) {
      await file.close();
    }
  }
};
