export class FileSizeLimitError extends Error {}

export type StorageFile = {
  size: number;
  lastModified: Date;
  stream: (range?: { start: number; end: number }, signal?: AbortSignal) => BodyInit;
  streamAsync?: (range?: { start: number; end: number }, signal?: AbortSignal) => Promise<BodyInit>;
  close: () => Promise<void>;
};

export type StoragePort = {
  buildPath: (userId: string, checksum: string, extension: string) => string;
  buildTemporaryPath: (extension: string) => string;
  buildUserAvatarPath: (userId: string) => string;
  buildImagePath: (imageId: string, variant: 'original' | 'thumbnail' | 'preview', extension: string) => string;
  copy: (sourcePath: string, targetPath: string) => Promise<void>;
  delete: (relativePath: string) => Promise<void>;
  deleteExternal?: (path: string) => Promise<void>;
  deleteTemporaryFilesOlderThan: (cutoff: Date, protectedPaths?: ReadonlySet<string>) => Promise<string[]>;
  importFile?: (sourcePath: string, relativePath: string) => Promise<void>;
  open: (relativePath: string) => Promise<StorageFile>;
  read: (relativePath: string) => Promise<Buffer>;
  readLimited: (relativePath: string, maximumBytes: number) => Promise<Buffer>;
  reference: (relativePath: string) => string;
  write: (relativePath: string, contents: Buffer) => Promise<void>;
};
