import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { LagomTakeoutParser } from 'src/imports/lagom-takeout.parser';
import { createTestZip } from 'test/utils/zip';

const lagomTakeoutParser = new LagomTakeoutParser();
const extractLagomTakeout = (...args: Parameters<LagomTakeoutParser['extractLagomTakeout']>) =>
  lagomTakeoutParser.extractLagomTakeout(...args);

describe('extractLagomTakeout', () => {
  it('imports English Strava media in activity order with captions', async () => {
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const archive = createTestZip({
      'activities.csv': Buffer.from(
        [
          'Activity ID,Activity Date,Activity Name,Activity Type,Filename,Elapsed Time,Media',
          '1,"Aug 10, 2016, 5:00:00 PM",Run,Run,activities/run.gpx,60,"media/one.png|media/two.png"',
        ].join('\n'),
      ),
      'media.csv': Buffer.from('Media Filename,Media Caption\nmedia/one.png,Front\nmedia/two.png,Back\n'),
      'activities/run.gpx': Buffer.from('gpx contents'),
      'media/one.png': image,
      'media/two.png': image,
    });

    const result = await extractLagomTakeout(archive);

    expect(
      result.activities[0]?.images.map(({ caption, sortOrder, file }) => ({
        caption,
        sortOrder,
        name: file.originalname,
      })),
    ).toEqual([
      { caption: 'Front', sortOrder: 0, name: 'one.png' },
      { caption: 'Back', sortOrder: 1, name: 'two.png' },
    ]);
  });

  it('imports the current profile name and picture', async () => {
    const image = Buffer.from('profile image');
    const archive = createTestZip({
      'activities.csv': Buffer.from('Activity ID,Activity Name,Activity Type,Filename\n'),
      'profile.csv': Buffer.from('Athlete ID,First Name,Last Name\n123,Jane,Doe\n'),
      'profile.jpg': image,
    });

    const result = await extractLagomTakeout(archive);

    expect(result.profile).toMatchObject({ firstName: 'Jane', lastName: 'Doe' });
    expect(result.profile?.avatar).toMatchObject({ originalname: 'profile.jpg', buffer: image, size: image.length });
  });

  it('reads the manifest and decompresses supported activity files', async () => {
    const archive = createTestZip({
      'export/activities.csv': {
        contents: Buffer.from(
          [
            'Activity ID,Activity Name,Activity Description,Activity Type,Filename',
            '1,"Run, easy","Easy morning run",Roller Ski,activities/one.fit.gz',
            '2,No file,,,',
            '3,Ride,,Ride,activities/two.gpx',
            '4,Unsupported,,,activities/data.json',
            '5,Missing,,,activities/missing.tcx',
          ].join('\r\n'),
        ),
        compress: true,
      },
      'export/activities/one.fit.gz': gzipSync(Buffer.from('fit contents')),
      'export/activities/two.gpx': Buffer.from('gpx contents'),
      'export/activities/data.json': Buffer.from('{}'),
    });

    const result = await extractLagomTakeout(archive);

    expect(result.totalActivities).toBe(5);
    expect(result.skipped).toBe(2);
    expect(result.activities.map(({ name }) => name)).toEqual(['Run, easy', 'Ride']);
    expect(result.activities.map(({ description }) => description)).toEqual(['Easy morning run', null]);
    expect(result.activities.map(({ sport }) => sport)).toEqual(['roller_ski', 'ride']);
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

  it('uses the CSV Activity ID as a stable identity for manual activities', async () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from(
        [
          'Activity ID,Activity Date,Activity Name,Activity Type,Filename,Elapsed Time,Moving Time,Distance,Distance,Average Speed,Elevation Gain,Calories',
          '12345,"Aug 10, 2016, 5:00:00 PM",10/08/2016,Run,,1495,1495,4.70,4700,2.95,0,624',
        ].join('\n'),
      ),
    });

    const result = await extractLagomTakeout(archive);

    expect(result.activities[0]?.manual).toMatchObject({
      sourceId: '12345',
      elapsedTime: 1495,
      distance: 4700,
      avgSpeed: 2.95,
      calories: 624,
    });
    expect(result.activities[0]?.sport).toBe('run');
  });

  it('uses the row number when a manual row has no Activity ID', async () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from(
        ['Activity Date,Activity Name,Activity Type,Filename,Elapsed Time', 'Aug 10, 2016, Run,,60'].join('\n'),
      ),
    });

    const result = await extractLagomTakeout(archive);

    expect(result.activities[0]?.manual?.sourceId).toBe('row:2');
  });

  it('hands a manual CSV activity to the import callback', async () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from(
        [
          'Activity ID,Activity Date,Activity Name,Activity Type,Filename,Elapsed Time,Moving Time,Distance,Distance',
          '1,"Aug 10, 2016, 5:00:00 PM",10/08/2016,Run,,1495,1495,4.70,4700',
        ].join('\n'),
      ),
    });
    const imported: string[] = [];

    const result = await extractLagomTakeout(archive, (activity) => {
      imported.push(activity.name ?? '');
      expect(activity.manual?.distance).toBe(4700);
      return Promise.resolve();
    });

    expect(imported).toEqual(['10/08/2016']);
    expect(result.activities).toEqual([]);
    expect(result.skipped).toBe(0);
  });

  it('rejects archives without an activities manifest', async () => {
    const archive = createTestZip({ 'profile.csv': Buffer.from('Name\nRunner') });

    await expect(extractLagomTakeout(archive)).rejects.toThrow('does not contain activities.csv');
  });

  it('does not follow filenames outside the takeout root', async () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from('Activity ID,Filename\n1,../secret.fit'),
      '../secret.fit': Buffer.from('secret'),
    });

    await expect(extractLagomTakeout(archive)).rejects.toThrow('unsafe entry path');
  });

  it('rejects an excessive central-directory entry count before opening the archive', async () => {
    const archive = createTestZip({ 'activities.csv': Buffer.from('Activity ID,Filename\n') });
    archive.writeUInt16LE(20_001, archive.length - 14);
    archive.writeUInt16LE(20_001, archive.length - 12);

    await expect(extractLagomTakeout(archive)).rejects.toThrow('too many entries');
  });

  it('does not expand ZIP entries with an excessive compression ratio', async () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from('Activity ID,Filename\n1,activities/large.gpx'),
      'activities/large.gpx': { contents: Buffer.alloc(1024 * 1024), compress: true },
    });

    const result = await extractLagomTakeout(archive);

    expect(result.activities).toEqual([]);
    expect(result.errors[0]?.message).toContain('compression ratio limit');
  });

  it('hands activities off as they are read instead of retaining their buffers', async () => {
    const archive = createTestZip({
      'activities.csv': Buffer.from('Activity ID,Filename\n1,activities/run.fit'),
      'activities/run.fit': Buffer.from('fit contents'),
    });
    const imported: string[] = [];

    const result = await extractLagomTakeout(archive, ({ file }) => {
      imported.push(file.buffer.toString());
      return Promise.resolve();
    });

    expect(result.activities).toEqual([]);
    expect(imported).toEqual(['fit contents']);
  });
});
