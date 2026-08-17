const MEBIBYTE = 1024 * 1024;

export const UPLOAD_LIMITS = {
  activityFileBytes: 64 * MEBIBYTE,
  takeoutFileBytes: 256 * MEBIBYTE,
  zipEntries: 20_000,
  zipEntryBytes: 64 * MEBIBYTE,
  zipExpandedBytes: 512 * MEBIBYTE,
  zipCompressionRatio: 200,
  manifestBytes: 16 * MEBIBYTE,
  manifestRows: 100_000,
  manifestRecordBytes: 64 * 1024,
  activityRecords: 1_000_000,
  activityLaps: 10_000,
  imageFileBytes: 25 * MEBIBYTE,
  avatarFileBytes: 10 * MEBIBYTE,
  imagePixels: 100_000_000,
} as const;
