export type UploadedFileData = {
  originalname: string;
  buffer: Buffer;
  size: number;
};

export type UploadStatus = 'pending' | 'parsed' | 'failed';
