import type { UploadReader } from 'src/api/uploads';
import { UPLOAD_LIMITS } from 'src/config/upload-limits';
import { BadRequestException, PayloadTooLargeException } from 'src/errors';
import type { UploadedFileData } from 'src/types/uploads';

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const requestLimitFor = (kind: Parameters<UploadReader['read']>[2]): number => {
  switch (kind) {
    case 'activity': {
      return UPLOAD_LIMITS.activityFileBytes;
    }
    case 'takeoutActivity': {
      return UPLOAD_LIMITS.activityFileBytes;
    }
    case 'avatar': {
      return UPLOAD_LIMITS.avatarFileBytes;
    }
    case 'image': {
      return UPLOAD_LIMITS.imageFileBytes;
    }
  }
};

export const workerUploadReader: UploadReader = {
  async read(request, _platform, kind): Promise<UploadedFileData | undefined> {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isSafeInteger(contentLength) && contentLength > requestLimitFor(kind) + MULTIPART_OVERHEAD_BYTES) {
      throw new PayloadTooLargeException('Multipart upload exceeds the configured Worker request limit');
    }
    const form = await request.formData();
    const value = form.get('file');
    if (value === null) {
      return undefined;
    }
    if (!(value instanceof File)) {
      throw new BadRequestException('The file form field must contain a file');
    }
    return {
      originalname: value.name || 'upload.bin',
      size: value.size,
      // Buffer is the historical service contract. Uint8Array is accepted by
      // R2 and remains free of Node runtime dependencies in the Worker.
      buffer: new Uint8Array(await value.arrayBuffer()) as unknown as Buffer,
    };
  },
};
