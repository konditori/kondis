import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { extractLagomTakeout } from 'src/utils/lagom';
import { createTestZip } from 'test/utils/zip';

describe('extractLagomTakeout', () => {
  it('reads the manifest and decompresses supported activity files', () => {
    const archive = createTestZip({
      'export/activities.csv': {
        contents: Buffer.from(
          [
            'Activity ID,Activity Name,Filename',
            '1,"Run, easy",activities/one.fit.gz',
            '2,No file,',
            '3,Ride,activities/two.gpx',
            '4,Unsupported,activities/data.json',
            '5,Missing,activities/missing.tcx',
          ].join('\r\n'),
        ),
        compress: true,
      },
      'export/activities/one.fit.gz': gzipSync(Buffer.from('fit contents')),
      'export/activities/two.gpx': Buffer.from('gpx contents'),
      'export/activities/data.json': Buffer.from('{}'),
    });

    const result = extractLagomTakeout(archive);

    expect(result.totalActivities).toBe(5);
    expect(result.skipped).toBe(2);
    expect(result.activities.map(({ file }) => file.originalname)).toEqual(['one.fit', 'two.gpx']);
    expect(result.activities[0].file.buffer.toString()).toBe('fit contents');
    expect(result.activities[1].file.buffer.toString()).toBe('gpx contents');
    expect(result.errors).toEqual([
      {
        row: 6,
        filename: 'activities/missing.tcx',
        message: 'Activity file is missing from the ZIP archive',
      },
    ]);
  });

  it('rejects archives without an activities manifest', () => {
    const archive = createTestZip({ 'profile.csv': Buffer.from('Name\nRunner') });

    expect(() => extractLagomTakeout(archive)).toThrow('does not contain activities.csv');
  });

  it('does not follow filenames outside the takeout root', () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from('Activity ID,Filename\n1,../secret.fit'),
      '../secret.fit': Buffer.from('secret'),
    });

    const result = extractLagomTakeout(archive);

    expect(result.activities).toEqual([]);
    expect(result.errors).toEqual([{ row: 2, filename: '../secret.fit', message: 'Unsafe activity filename' }]);
  });
});
