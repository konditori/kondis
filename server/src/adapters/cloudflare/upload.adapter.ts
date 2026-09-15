import type { TakeoutActivityUpload, UploadReader } from 'src/types';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { UploadKind } from 'src/enum';
import { BadRequestException, PayloadTooLargeException } from 'src/errors';
import type { UploadedFileData } from 'src/types/uploads';

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const requestLimitFor = (kind: Parameters<UploadReader['read']>[2]): number => {
  switch (kind) {
    case UploadKind.Activity:
    case UploadKind.TakeoutActivity: {
      return UPLOAD_LIMITS.activityFileBytes;
    }
    case UploadKind.Avatar: {
      return UPLOAD_LIMITS.avatarFileBytes;
    }
    case UploadKind.TakeoutPhoto:
    case UploadKind.Image: {
      return UPLOAD_LIMITS.imageFileBytes;
    }
  }
  throw new Error(`Unsupported upload kind: ${kind}`);
};

export const workerUploadReader: UploadReader = {
  async read(request, _platform, kind): Promise<UploadedFileData | TakeoutActivityUpload | undefined> {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isSafeInteger(contentLength) && contentLength > requestLimitFor(kind) + MULTIPART_OVERHEAD_BYTES) {
      throw new PayloadTooLargeException('Multipart upload exceeds the configured Worker request limit');
    }
    const form = await request.formData();
    const value = form.get('file');
    const metadata = form.get('metadata');
    if (value === null) {
      return kind === UploadKind.TakeoutActivity || kind === UploadKind.TakeoutPhoto
        ? ({ file: undefined, metadata: metadata?.toString() } satisfies TakeoutActivityUpload)
        : undefined;
    }
    if (!(value instanceof File)) {
      throw new BadRequestException('The file form field must contain a file');
    }
    const file = {
      originalname: value.name || 'upload.bin',
      size: value.size,
      buffer: new Uint8Array(await value.arrayBuffer()) as unknown as Buffer,
    };
    return kind === UploadKind.TakeoutActivity || kind === UploadKind.TakeoutPhoto
      ? { file, metadata: metadata?.toString() }
      : file;
  },
};
