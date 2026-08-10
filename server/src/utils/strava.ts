import { basename, extname, posix } from 'node:path';
import { gunzipSync, inflateRawSync } from 'node:zlib';

import type { UploadedFitFile } from 'src/types';

const ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);
const MANIFEST_NAME = 'activities.csv';
const CENTRAL_DIRECTORY_SIGNATURE = 0x02_01_4b_50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06_05_4b_50;
const LOCAL_FILE_SIGNATURE = 0x04_03_4b_50;

export type StravaTakeoutActivity = {
  row: number;
  filename: string;
  file: UploadedFitFile;
};

export type StravaTakeoutError = {
  row: number;
  filename: string;
  message: string;
};

export type StravaTakeoutContents = {
  totalActivities: number;
  skipped: number;
  activities: StravaTakeoutActivity[];
  errors: StravaTakeoutError[];
};

const assertRange = (contents: Buffer, offset: number, length: number): void => {
  if (offset < 0 || length < 0 || offset + length > contents.length) {
    throw new Error('ZIP archive contains an invalid entry offset or size');
  }
};

const findEndOfCentralDirectory = (contents: Buffer): number => {
  // The record is at least 22 bytes and may be followed by a comment of at most 65,535 bytes.
  const firstCandidate = Math.max(0, contents.length - 22 - 65_535);
  for (let offset = contents.length - 22; offset >= firstCandidate; offset -= 1) {
    if (
      contents.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE &&
      offset + 22 + contents.readUInt16LE(offset + 20) === contents.length
    ) {
      return offset;
    }
  }
  throw new Error('ZIP end-of-directory record is missing');
};

const unzip = (contents: Buffer): Record<string, Uint8Array> => {
  const endOffset = findEndOfCentralDirectory(contents);
  const disk = contents.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = contents.readUInt16LE(endOffset + 6);
  const entryCount = contents.readUInt16LE(endOffset + 10);
  const centralDirectorySize = contents.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = contents.readUInt32LE(endOffset + 16);

  if (disk !== 0 || centralDirectoryDisk !== 0) {
    throw new Error('Multi-disk ZIP archives are not supported');
  }
  if (entryCount === 0xff_ff || centralDirectorySize === 0xff_ff_ff_ff || centralDirectoryOffset === 0xff_ff_ff_ff) {
    throw new Error('ZIP64 archives are not supported');
  }
  assertRange(contents, centralDirectoryOffset, centralDirectorySize);

  const entries: Record<string, Uint8Array> = {};
  let offset = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assertRange(contents, offset, 46);
    if (contents.readUInt32LE(offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('ZIP central directory is malformed');
    }

    const flags = contents.readUInt16LE(offset + 8);
    const method = contents.readUInt16LE(offset + 10);
    const compressedSize = contents.readUInt32LE(offset + 20);
    const uncompressedSize = contents.readUInt32LE(offset + 24);
    const filenameLength = contents.readUInt16LE(offset + 28);
    const extraLength = contents.readUInt16LE(offset + 30);
    const commentLength = contents.readUInt16LE(offset + 32);
    const localOffset = contents.readUInt32LE(offset + 42);
    assertRange(contents, offset + 46, filenameLength + extraLength + commentLength);

    if ((flags & 1) !== 0) {
      throw new Error('Encrypted ZIP entries are not supported');
    }

    const filename = contents.subarray(offset + 46, offset + 46 + filenameLength).toString('utf8');
    assertRange(contents, localOffset, 30);
    if (contents.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error(`ZIP entry ${filename} has an invalid local header`);
    }

    const localFilenameLength = contents.readUInt16LE(localOffset + 26);
    const localExtraLength = contents.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localFilenameLength + localExtraLength;
    assertRange(contents, dataOffset, compressedSize);
    const compressed = contents.subarray(dataOffset, dataOffset + compressedSize);

    let uncompressed: Buffer;
    if (method === 0) {
      uncompressed = Buffer.from(compressed);
    } else if (method === 8) {
      uncompressed = inflateRawSync(compressed);
    } else {
      throw new Error(`ZIP entry ${filename} uses unsupported compression method ${method}`);
    }
    if (uncompressed.length !== uncompressedSize) {
      throw new Error(`ZIP entry ${filename} has an invalid uncompressed size`);
    }
    if (filename in entries) {
      throw new Error(`ZIP archive contains duplicate entry ${filename}`);
    }

    entries[filename] = uncompressed;
    offset += 46 + filenameLength + extraLength + commentLength;
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

export const extractStravaTakeout = (contents: Buffer): StravaTakeoutContents => {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzip(contents);
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

  const result: StravaTakeoutContents = {
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
