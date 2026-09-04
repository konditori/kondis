export class FileSizeLimitError extends Error {}

export type StoragePort = {
  absolutePath: (relativePath: string) => string;
  buildPath: (userId: string, checksum: string, extension: string) => string;
  buildTemporaryPath: (extension: string) => string;
  buildUserAvatarPath: (userId: string) => string;
  copy: (sourcePath: string, targetPath: string) => Promise<void>;
  delete: (relativePath: string) => Promise<void>;
  deleteExternal: (path: string) => Promise<void>;
  importFile: (sourcePath: string, relativePath: string) => Promise<void>;
  read: (relativePath: string) => Promise<Buffer>;
  readLimited: (relativePath: string, maximumBytes: number) => Promise<Buffer>;
  readStream: (relativePath: string) => AsyncIterable<Uint8Array>;
  size: (relativePath: string) => Promise<number>;
  write: (relativePath: string, contents: Buffer) => Promise<void>;
};
