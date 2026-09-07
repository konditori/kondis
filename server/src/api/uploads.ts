import type { ApiBindings } from 'src/api/auth';
import type { BufferedUploadedFileData, UploadedFileData } from 'src/types/uploads';

export type UploadKind = 'activity' | 'takeoutActivity' | 'avatar' | 'image';
export type ImageUpload = {
  file: BufferedUploadedFileData | undefined;
  caption: string | undefined;
};
export type TakeoutActivityUpload = {
  file: UploadedFileData | undefined;
  metadata: string | undefined;
};

export type UploadReader = {
  read: (
    request: Request,
    platform: ApiBindings | undefined,
    kind: UploadKind,
  ) => Promise<ImageUpload | TakeoutActivityUpload | UploadedFileData | undefined>;
};
