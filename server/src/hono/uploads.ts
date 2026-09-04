import type { HonoBindings } from 'src/hono/auth';
import type { UploadedFileData } from 'src/types/uploads';

export type UploadKind = 'activity' | 'avatar' | 'takeout';

export type HonoUploadReader = {
  read: (
    request: Request,
    platform: HonoBindings | undefined,
    kind: UploadKind,
  ) => Promise<UploadedFileData | undefined>;
};
