import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { type UploadedFitFile } from 'src/types';

export type TestAsset = {
  filename: string;
  path: string;
};

export const testAssetDirectory = resolve(__dirname, '../../../test/test-assets');

export const activityFixtures = {
  hindasRun: {
    filename: '2015-06-22-run.fit',
    path: resolve(testAssetDirectory, 'activities/running/2015-hindas/2015-06-22-run.fit'),
  },
} as const satisfies Record<string, TestAsset>;

export const hasTestAsset = ({ path }: TestAsset): boolean => existsSync(path);

export const makeUploadedFile = (filename: string, buffer: Buffer): UploadedFitFile =>
  ({ originalname: filename, buffer, size: buffer.length }) as UploadedFitFile;
