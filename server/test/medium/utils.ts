import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { type UploadedFitFile } from 'src/types';

export type TestAsset = {
  expectedSport: string;
  filename: string;
  path: string;
};

export const testAssetDirectory = resolve(__dirname, '../../../test/test-assets');

export const activityFixtures = {
  hindasRun: {
    expectedSport: 'running',
    filename: '2015-06-22-run.fit',
    path: resolve(testAssetDirectory, 'activities/running/2015-hindas/2015-06-22-run.fit'),
  },
  orsaAlpineSki: {
    expectedSport: 'other',
    filename: '2013-01-13-orsa.tcx',
    path: resolve(testAssetDirectory, 'activities/alpine-ski/2013-01-13-orsa.tcx'),
  },
  sampleRun: {
    expectedSport: 'running',
    filename: '2024-03-01-run.gpx',
    path: resolve(testAssetDirectory, 'activities/running/2024-san-francisco/2024-03-01-run.gpx'),
  },
} as const satisfies Record<string, TestAsset>;

export const hasTestAsset = ({ path }: TestAsset): boolean => existsSync(path);

export const makeUploadedFile = (filename: string, buffer: Buffer): UploadedFitFile =>
  ({ originalname: filename, buffer, size: buffer.length }) as UploadedFitFile;
