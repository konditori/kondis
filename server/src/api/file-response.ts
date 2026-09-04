import { NotFoundException } from 'src/errors';

export type FileRange = { start: number; end: number };
export type FileReader = {
  stat: (path: string) => Promise<{ lastModified: Date }>;
  read: (path: string, range?: FileRange) => Promise<BodyInit>;
};

type FileResponseOptions = {
  size: number;
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
    return { start: Number.isSafeInteger(suffixLength) && suffixLength < size ? size - suffixLength : 0, end: size - 1 };
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

export const fileResponse = async (
  request: Request,
  files: FileReader,
  path: string,
  options: FileResponseOptions,
): Promise<Response> => {
  let lastModified: Date;
  try {
    ({ lastModified } = await files.stat(path));
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new NotFoundException(options.missingMessage);
    }
    throw error;
  }

  const headers = new Headers(options.headers);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Last-Modified', lastModified.toUTCString());
  if (notModified(request, lastModified)) {
    return new Response(null, { status: 304, headers });
  }

  const range = request.method === 'GET' ? parseRange(request.headers.get('Range'), options.size) : undefined;
  if (range === 'unsatisfiable') {
    headers.set('Content-Range', `bytes */${options.size}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }

  const status = range ? 206 : 200;
  if (range) {
    headers.set('Content-Range', `bytes ${range.start}-${range.end}/${options.size}`);
    headers.set('Content-Length', String(range.end - range.start + 1));
  } else {
    headers.set('Content-Length', String(options.size));
  }
  if (request.method === 'HEAD') {
    return new Response(null, { status, headers });
  }

  let body: BodyInit;
  try {
    body = await files.read(path, range);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new NotFoundException(options.missingMessage);
    }
    throw error;
  }
  return new Response(body, { status, headers });
};
