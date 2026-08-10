import { basename, extname, posix } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { Open } from 'unzipper';

import type { UploadedFileData } from 'src/types';

const ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);
const MANIFEST_NAME = 'activities.csv';

// Lagom is a codename for the commercial app that should not be named

export type LagomTakeoutActivity = {
  row: number;
  filename: string;
  file: UploadedFileData;
};

export type LagomTakeoutError = {
  row: number;
  filename: string;
  message: string;
};

export type LagomTakeoutContents = {
  totalActivities: number;
  skipped: number;
  activities: LagomTakeoutActivity[];
  errors: LagomTakeoutError[];
};

const unzip = async (contents: Buffer): Promise<Record<string, Buffer>> => {
  const directory = await Open.buffer(contents);
  const entries: Record<string, Buffer> = {};

  for (const entry of directory.files) {
    if (entry.type === 'Directory') {
      continue;
    }

    const filename = entry.path;
    if (filename in entries) {
      throw new Error(`ZIP archive contains duplicate entry ${filename}`);
    }

    entries[filename] = await entry.buffer();
  }

  return entries;
};

const parseCsv = (contents: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  const finishValue = (): void => {
    row.push(value);
    value = '';
  };
  const finishRow = (): void => {
    finishValue();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];

    if (character === '"') {
      if (quoted && contents[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      finishValue();
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && contents[index + 1] === '\n') {
        index += 1;
      }
      finishRow();
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error('activities.csv contains an unterminated quoted field');
  }
  if (value.length > 0 || row.length > 0) {
    finishRow();
  }

  return rows;
};

const normalizeReference = (filename: string): string | undefined => {
  const slashPath = filename.replaceAll('\\', '/');
  if (slashPath.startsWith('/') || slashPath.split('/').includes('..')) {
    return;
  }

  const normalized = posix.normalize(slashPath).replace(/^\.\//, '');
  return normalized === '.' ? undefined : normalized;
};

export const extractLagomTakeout = async (contents: Buffer): Promise<LagomTakeoutContents> => {
  let entries: Record<string, Buffer>;
  try {
    entries = await unzip(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not uncompress ZIP archive: ${message}`, { cause: error });
  }

  const manifests = Object.keys(entries).filter((path) => path === MANIFEST_NAME || path.endsWith(`/${MANIFEST_NAME}`));
  if (manifests.length !== 1) {
    throw new Error(
      manifests.length === 0
        ? `ZIP archive does not contain ${MANIFEST_NAME}`
        : `ZIP archive contains more than one ${MANIFEST_NAME}`,
    );
  }

  const manifestPath = manifests[0];
  const archiveRoot = manifestPath.slice(0, -MANIFEST_NAME.length);
  const rows = parseCsv(Buffer.from(entries[manifestPath]).toString('utf8'));
  const headers = rows.shift();
  if (!headers) {
    throw new Error(`${MANIFEST_NAME} is empty`);
  }

  headers[0] = headers[0].replace(/^\u{FEFF}/u, '');
  const filenameIndex = headers.indexOf('Filename');
  if (filenameIndex === -1) {
    throw new Error(`${MANIFEST_NAME} does not contain a Filename column`);
  }

  const result: LagomTakeoutContents = {
    totalActivities: rows.length,
    skipped: 0,
    activities: [],
    errors: [],
  };

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const filename = row[filenameIndex]?.trim() ?? '';
    if (!filename) {
      result.skipped += 1;
      continue;
    }

    const normalized = normalizeReference(filename);
    if (!normalized) {
      result.errors.push({ row: rowNumber, filename, message: 'Unsafe activity filename' });
      continue;
    }

    const compressed = normalized.toLowerCase().endsWith('.gz');
    const originalname = basename(compressed ? normalized.slice(0, -3) : normalized);
    if (!ACTIVITY_EXTENSIONS.has(extname(originalname).toLowerCase())) {
      result.skipped += 1;
      continue;
    }

    const archived = entries[`${archiveRoot}${normalized}`];
    if (!archived) {
      result.errors.push({ row: rowNumber, filename, message: 'Activity file is missing from the ZIP archive' });
      continue;
    }

    try {
      const buffer = Buffer.from(compressed ? gunzipSync(archived) : archived);
      result.activities.push({
        row: rowNumber,
        filename,
        file: { originalname, buffer, size: buffer.length },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ row: rowNumber, filename, message: `Could not uncompress activity: ${message}` });
    }
  }

  return result;
};
