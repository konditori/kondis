import { basename, extname, posix } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { parse } from 'csv-parse/sync';
import { Open, type File as ZipEntry } from 'unzipper';

import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { ActivityType, toActivityType } from 'src/domain/activity-type';
import type { UploadedFileData } from 'src/types';

const ACTIVITY_EXTENSIONS = new Set(['.fit', '.tcx', '.gpx']);
const MANIFEST_NAME = 'activities.csv';
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06_05_4b_50;
const END_OF_CENTRAL_DIRECTORY_BYTES = 22;
const MAX_ZIP_COMMENT_BYTES = 0xff_ff;

// Lagom is a codename for the commercial app that should not be named

export type LagomTakeoutActivity = {
  row: number;
  filename: string;
  name: string | null;
  description: string | null;
  sport: ActivityType | null;
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

class TakeoutLimitError extends Error {}

const assertSafeZipStructure = (contents: Buffer): void => {
  const earliestOffset = Math.max(0, contents.length - END_OF_CENTRAL_DIRECTORY_BYTES - MAX_ZIP_COMMENT_BYTES);
  let offset = contents.length - END_OF_CENTRAL_DIRECTORY_BYTES;

  for (; offset >= earliestOffset; offset -= 1) {
    if (contents.readUInt32LE(offset) !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      continue;
    }

    const commentLength = contents.readUInt16LE(offset + 20);
    if (offset + END_OF_CENTRAL_DIRECTORY_BYTES + commentLength === contents.length) {
      break;
    }
  }

  if (offset < earliestOffset) {
    throw new Error('ZIP archive has no valid central directory');
  }

  const disk = contents.readUInt16LE(offset + 4);
  const centralDirectoryDisk = contents.readUInt16LE(offset + 6);
  const recordsOnDisk = contents.readUInt16LE(offset + 8);
  const recordCount = contents.readUInt16LE(offset + 10);
  const centralDirectoryBytes = contents.readUInt32LE(offset + 12);
  const centralDirectoryOffset = contents.readUInt32LE(offset + 16);

  if (
    disk !== 0 ||
    centralDirectoryDisk !== 0 ||
    recordsOnDisk !== recordCount ||
    recordCount === 0xff_ff ||
    centralDirectoryBytes === 0xff_ff_ff_ff ||
    centralDirectoryOffset === 0xff_ff_ff_ff
  ) {
    throw new Error('Multi-disk and ZIP64 archives are not supported');
  }
  if (recordCount > UPLOAD_LIMITS.zipEntries) {
    throw new Error(`ZIP archive contains too many entries (maximum ${UPLOAD_LIMITS.zipEntries})`);
  }
  if (centralDirectoryOffset + centralDirectoryBytes > offset) {
    throw new Error('ZIP archive has an invalid central directory range');
  }
};

const normalizeArchivePath = (filename: string): string | undefined => {
  const slashPath = filename.replaceAll('\\', '/');
  if (slashPath.includes('\0') || slashPath.startsWith('/') || slashPath.split('/').includes('..')) {
    return;
  }

  const normalized = posix.normalize(slashPath).replace(/^\.\//, '');
  return normalized === '.' ? undefined : normalized;
};

const assertEntrySize = (entry: ZipEntry, maximumBytes: number): void => {
  if (!Number.isSafeInteger(entry.compressedSize) || !Number.isSafeInteger(entry.uncompressedSize)) {
    throw new TypeError(`ZIP entry ${entry.path} has an invalid size`);
  }
  if (entry.compressedSize < 0 || entry.uncompressedSize < 0 || entry.uncompressedSize > maximumBytes) {
    throw new Error(`ZIP entry ${entry.path} exceeds the ${maximumBytes}-byte expanded size limit`);
  }

  const ratio =
    entry.compressedSize === 0
      ? entry.uncompressedSize === 0
        ? 1
        : Infinity
      : entry.uncompressedSize / entry.compressedSize;
  if (ratio > UPLOAD_LIMITS.zipCompressionRatio) {
    throw new Error(
      `ZIP entry ${entry.path} exceeds the ${UPLOAD_LIMITS.zipCompressionRatio}:1 compression ratio limit`,
    );
  }
};

const readEntry = async (entry: ZipEntry, maximumBytes: number): Promise<Buffer> => {
  assertEntrySize(entry, maximumBytes);

  const chunks: Buffer[] = [];
  let byteSize = 0;
  for await (const value of entry.stream()) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value as Uint8Array);
    byteSize += chunk.length;
    if (byteSize > maximumBytes) {
      throw new Error(`ZIP entry ${entry.path} exceeds the ${maximumBytes}-byte expanded size limit`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks, byteSize);
};

const gunzipActivity = (contents: Buffer): Buffer => {
  if (contents.length >= 4) {
    const declaredBytes = contents.readUInt32LE(contents.length - 4);
    if (declaredBytes > UPLOAD_LIMITS.activityFileBytes) {
      throw new Error(`GZIP activity exceeds the ${UPLOAD_LIMITS.activityFileBytes}-byte expanded size limit`);
    }

    const ratio = contents.length === 0 ? Infinity : declaredBytes / contents.length;
    if (ratio > UPLOAD_LIMITS.zipCompressionRatio) {
      throw new Error(`GZIP activity exceeds the ${UPLOAD_LIMITS.zipCompressionRatio}:1 compression ratio limit`);
    }
  }

  try {
    return Buffer.from(gunzipSync(contents, { maxOutputLength: UPLOAD_LIMITS.activityFileBytes }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
      throw new TakeoutLimitError(`GZIP activity exceeded ${UPLOAD_LIMITS.activityFileBytes} expanded bytes`, {
        cause: error,
      });
    }
    throw error;
  }
};

export const extractLagomTakeout = async (
  contents: Buffer,
  onActivity?: (activity: LagomTakeoutActivity) => Promise<void>,
): Promise<LagomTakeoutContents> => {
  if (contents.length > UPLOAD_LIMITS.takeoutFileBytes) {
    throw new Error(`ZIP archive exceeds the ${UPLOAD_LIMITS.takeoutFileBytes}-byte upload limit`);
  }

  let directory: Awaited<ReturnType<typeof Open.buffer>>;
  try {
    assertSafeZipStructure(contents);
    directory = await Open.buffer(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not open ZIP archive: ${message}`, { cause: error });
  }

  if (directory.files.length > UPLOAD_LIMITS.zipEntries) {
    throw new Error(`ZIP archive contains too many entries (maximum ${UPLOAD_LIMITS.zipEntries})`);
  }

  const entries = new Map<string, ZipEntry>();
  for (const rawEntry of directory.files) {
    const normalized = normalizeArchivePath(rawEntry.path);
    if (!normalized) {
      throw new Error(`ZIP archive contains an unsafe entry path: ${rawEntry.path}`);
    }
    if (rawEntry.type === 'Directory') {
      continue;
    }
    if (entries.has(normalized)) {
      throw new Error(`ZIP archive contains duplicate entry ${normalized}`);
    }
    entries.set(normalized, rawEntry);
  }

  const manifests: string[] = [];
  for (const path of entries.keys()) {
    if (path === MANIFEST_NAME || path.endsWith(`/${MANIFEST_NAME}`)) {
      manifests.push(path);
    }
  }
  if (manifests.length !== 1) {
    throw new Error(
      manifests.length === 0
        ? `ZIP archive does not contain ${MANIFEST_NAME}`
        : `ZIP archive contains more than one ${MANIFEST_NAME}`,
    );
  }

  const manifestPath = manifests[0];
  const archiveRoot = manifestPath.slice(0, -MANIFEST_NAME.length);
  const manifest = await readEntry(entries.get(manifestPath)!, UPLOAD_LIMITS.manifestBytes);
  const rows = parse(manifest.toString('utf8'), {
    bom: true,
    relax_column_count: true,
    max_record_size: UPLOAD_LIMITS.manifestRecordBytes,
  }) as string[][];
  if (rows.length > UPLOAD_LIMITS.manifestRows + 1) {
    throw new Error(`activities.csv contains too many rows (maximum ${UPLOAD_LIMITS.manifestRows})`);
  }

  const headers = rows.shift();
  if (!headers) {
    throw new Error(`${MANIFEST_NAME} is empty`);
  }

  const filenameIndex = headers.indexOf('Filename');
  if (filenameIndex === -1) {
    throw new Error(`${MANIFEST_NAME} does not contain a Filename column`);
  }
  const nameIndex = headers.indexOf('Activity Name');
  const descriptionIndex = headers.indexOf('Activity Description');
  const sportIndex = headers.indexOf('Activity Type');

  const result: LagomTakeoutContents = {
    totalActivities: rows.length,
    skipped: 0,
    activities: [],
    errors: [],
  };
  const referencedEntries = new Set<string>();
  let expandedBytes = 0;

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const filename = row[filenameIndex]?.trim() ?? '';
    const name = nameIndex === -1 ? null : row[nameIndex]?.trim() || null;
    const description = descriptionIndex === -1 ? null : row[descriptionIndex]?.trim() || null;
    const manifestSport = sportIndex === -1 ? '' : (row[sportIndex]?.trim() ?? '');
    const sport = manifestSport ? toActivityType(manifestSport) : null;
    if (!filename) {
      result.skipped += 1;
      continue;
    }

    const normalized = normalizeArchivePath(filename);
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

    const entryPath = `${archiveRoot}${normalized}`;
    const archived = entries.get(entryPath);
    if (!archived) {
      result.errors.push({ row: rowNumber, filename, message: 'Activity file is missing from the ZIP archive' });
      continue;
    }
    if (referencedEntries.has(entryPath)) {
      result.errors.push({ row: rowNumber, filename, message: 'Activity file is referenced more than once' });
      continue;
    }
    referencedEntries.add(entryPath);

    let activity: LagomTakeoutActivity;
    try {
      const entryContents = await readEntry(archived, UPLOAD_LIMITS.zipEntryBytes);
      const buffer = compressed ? gunzipActivity(entryContents) : entryContents;
      if (buffer.length > UPLOAD_LIMITS.activityFileBytes) {
        throw new Error(`Activity exceeds the ${UPLOAD_LIMITS.activityFileBytes}-byte expanded size limit`);
      }

      expandedBytes += buffer.length;
      if (expandedBytes > UPLOAD_LIMITS.zipExpandedBytes) {
        throw new TakeoutLimitError(
          `Takeout activities exceed the ${UPLOAD_LIMITS.zipExpandedBytes}-byte expanded size limit`,
        );
      }

      activity = {
        row: rowNumber,
        filename,
        name,
        description,
        sport,
        file: { originalname, buffer, size: buffer.length },
      };
    } catch (error) {
      if (error instanceof TakeoutLimitError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push({ row: rowNumber, filename, message: `Could not read activity: ${message}` });
      continue;
    }

    if (onActivity) {
      await onActivity(activity);
    } else {
      result.activities.push(activity);
    }
  }

  return result;
};
