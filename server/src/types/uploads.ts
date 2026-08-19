type UploadedFileBase = {
  originalname: string;
  size: number;
};

export type BufferedUploadedFileData = UploadedFileBase & { buffer: Buffer; path?: never };
export type DiskUploadedFileData = UploadedFileBase & { path: string; buffer?: never };
export type UploadedFileData = BufferedUploadedFileData | DiskUploadedFileData;

export type UploadStatus = 'pending' | 'parsed' | 'failed';
