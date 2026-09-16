export class FileSizeLimitError extends Error {}

export type StorageFile = {
  size: number;
  lastModified: Date;
  stream: (range?: { start: number; end: number }, signal?: AbortSignal) => BodyInit;
  streamAsync?: (range?: { start: number; end: number }, signal?: AbortSignal) => Promise<BodyInit>;
  close: () => Promise<void>;
};

export abstract class StorageRepository {
  abstract buildPath(userId: string, checksum: string, extension: string): string;
  abstract buildTemporaryPath(extension: string): string;
  abstract buildUserAvatarPath(userId: string): string;
  abstract buildImagePath(imageId: string, variant: 'original' | 'thumbnail' | 'preview', extension: string): string;
  abstract copy(sourcePath: string, targetPath: string): Promise<void>;
  abstract delete(relativePath: string): Promise<void>;
  abstract deleteTemporaryFilesOlderThan(cutoff: Date, protectedPaths?: ReadonlySet<string>): Promise<string[]>;
  abstract open(relativePath: string): Promise<StorageFile>;
  abstract read(relativePath: string): Promise<Buffer>;
  abstract readLimited(relativePath: string, maximumBytes: number): Promise<Buffer>;
  abstract reference(relativePath: string): string;
  abstract write(relativePath: string, contents: Buffer): Promise<void>;

  // Only filesystem-backed implementations support external paths.
  deleteExternal?: (path: string) => Promise<void>;
  importFile?: (sourcePath: string, relativePath: string) => Promise<void>;
}
