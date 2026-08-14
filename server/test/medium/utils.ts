import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type ActivityType } from 'src/types';

export type TestAsset = {
  expectedSport: ActivityType;
  filename: string;
  path: string;
};

const currentDirectory = dirname(fileURLToPath(import.meta.url));

export const testAssetDirectory = resolve(currentDirectory, '../../../test/test-assets');

export const activityFixtures = {
  hindasRun: {
    expectedSport: 'run',
    filename: '2015-06-22-run.fit',
    path: resolve(testAssetDirectory, 'activities/running/2015-hindas/2015-06-22-run.fit'),
  },
  orsaAlpineSki: {
    expectedSport: 'other',
    filename: '2013-01-13-orsa.tcx',
    path: resolve(testAssetDirectory, 'activities/alpine-ski/2013-01-13-orsa.tcx'),
  },
  sampleRun: {
    expectedSport: 'run',
    filename: '2024-03-01-run.gpx',
    path: resolve(testAssetDirectory, 'activities/running/2024-san-francisco/2024-03-01-run.gpx'),
  },
} as const satisfies Record<string, TestAsset>;

export const syntheticActivityFixtures = {
  missingRecordDistanceFit: {
    expectedSport: 'run',
    filename: 'synthetic-missing-record-distance.fit',
    path: resolve(
      testAssetDirectory,
      'activities/running/missing-distance-stream/synthetic-missing-record-distance.fit',
    ),
  },
} as const satisfies Record<string, TestAsset>;

export const hasTestAsset = ({ path }: TestAsset): boolean => existsSync(path);
