import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { readFile, utimes, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { png } from './png';

export const runName = 'Morning, "breeze" 🏃';
export const runDescription = 'First line, with a comma.\nSecond line: "Återhämtning" 走る';
export const manualName = 'Synthetic lunch walk';
const fixtureRoot = resolve(import.meta.dirname, '../../../test/test-assets');
const timestamp = new Date('2000-01-01T00:00:00Z');

// Export column order is intentionally independent of the production parser.
// Repeated columns are part of Strava's export format; the second Distance is meters.
const headers = [
  'Activity ID',
  'Activity Date',
  'Activity Name',
  'Activity Type',
  'Activity Description',
  'Elapsed Time',
  'Distance',
  'Max Heart Rate',
  'Relative Effort',
  'Commute',
  'Activity Private Note',
  'Activity Gear',
  'Filename',
  'Athlete Weight',
  'Bike Weight',
  'Elapsed Time',
  'Moving Time',
  'Distance',
  'Max Speed',
  'Average Speed',
  'Elevation Gain',
  'Elevation Loss',
  'Average Heart Rate',
  'Calories',
  'Media',
];

const csvRow = (fields: Array<string | number>) =>
  fields.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(',');
function row(id: number, name: string, filename: string, sport = 'Run', description = '', commute = '') {
  return csvRow([
    id,
    'Jan 3, 2030, 12:00:00 PM',
    name,
    sport,
    description,
    1800,
    2.5,
    '',
    '',
    commute,
    '',
    '',
    filename,
    '',
    '',
    1801,
    1500,
    2500,
    '',
    '',
    12,
    '',
    '',
    '',
    id === 9001 ? 'media/photo.png|media/video.mp4' : id === 9005 ? 'media/manual.png' : '',
  ]);
}

// Invented coordinates in the open Pacific, fixed times, no account or device metadata.
function points(day: number) {
  return Array.from({ length: 12 }, (_, index) => ({
    lat: 0,
    lon: -140 + index * 0.0001,
    altitude: 10 + index,
    time: new Date(Date.UTC(2030, 0, day, 10, index)).toISOString(),
    distance: index * 11.12,
  }));
}
function gpx(day = 1) {
  return `<?xml version="1.0"?><gpx version="1.1" creator="Kondis synthetic test" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Embedded GPX name</name><trkseg>${points(
    day,
  )
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><ele>${p.altitude}</ele><time>${p.time}</time></trkpt>`)
    .join('')}</trkseg></trk></gpx>`;
}
function tcx() {
  return `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Running"><Id>2030-01-02T10:00:00Z</Id><Lap StartTime="2030-01-02T10:00:00Z"><TotalTimeSeconds>660</TotalTimeSeconds><DistanceMeters>122.32</DistanceMeters><Calories>50</Calories><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${points(
    2,
  )
    .map(
      (p) =>
        `<Trackpoint><Time>${p.time}</Time><Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position><AltitudeMeters>${p.altitude}</AltitudeMeters><DistanceMeters>${p.distance}</DistanceMeters></Trackpoint>`,
    )
    .join('')}</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
}

type Options = {
  root?: string;
  zip64?: boolean;
  variant?: 'mixed' | 'partial' | 'missing-manifest' | 'ambiguous-manifest' | 'corrupt' | 'empty';
  extraActivities?: number;
};

export async function makeTakeout(
  path: string,
  { root = '', zip64 = false, variant = 'mixed', extraActivities = 0 }: Options = {},
) {
  const files = new Map<string, Uint8Array>();
  const text = (name: string, contents: string) => files.set(name, new TextEncoder().encode(contents));
  const rows: string[] = [];
  if (variant !== 'empty') {
    files.set(
      'activities/run.fit',
      await readFile(resolve(fixtureRoot, 'activities/running/2015-hindas/2015-06-22-run.fit')),
    );
    files.set(
      'activities/short.fit.gz',
      gzipSync(
        await readFile(
          resolve(fixtureRoot, 'activities/running/missing-distance-stream/synthetic-missing-record-distance.fit'),
        ),
      ),
    );
    files.set('activities/ride.gpx.gz', gzipSync(gpx()));
    files.set('activities/run.tcx.gz', gzipSync(tcx()));
    rows.push(
      row(9001, runName, 'activities/run.fit', 'Trail Run', runDescription),
      row(9002, 'Synthetic short run', 'activities/short.fit.gz'),
      row(9003, 'Synthetic commute', 'activities/ride.gpx.gz', 'Ride', '', 'true'),
      row(9004, 'Synthetic TCX run', 'activities/run.tcx.gz'),
      row(9005, manualName, '', 'Walk'),
    );
  }
  if (variant === 'partial') {
    rows.push(
      row(9010, 'Missing activity', 'activities/missing.fit'),
      row(9011, 'Broken gzip', 'activities/broken.fit.gz'),
      row(9012, 'Broken FIT', 'activities/broken.fit'),
    );
    files.set('activities/broken.fit.gz', Uint8Array.of(31, 139, 8, 0));
    text('activities/broken.fit', 'This is deliberately not a FIT activity.');
  }
  for (let index = 0; index < extraActivities; index++) {
    const name = `activities/extra-${index}.gpx`;
    text(name, gpx(index + 10));
    rows.push(row(10_000 + index, `Synthetic extra ${index}`, name));
  }
  text('activities.csv', '\u{FEFF}' + [csvRow(headers), ...rows].join('\r\n') + '\r\n');
  text(
    'media.csv',
    'Media Filename,Media Caption\r\nmedia/photo.png,"Synthetic, caption"\r\nmedia/manual.png,Manual photo\r\n',
  );
  files.set('media/photo.png', png(1));
  files.set('media/manual.png', png(2));
  files.set('profile.png', png(3));
  text(
    'profile.csv',
    'Athlete ID,Email Address,First Name,Last Name\r\n99999,unused@example.com,Synthetic,Importer\r\n',
  );
  // Video is deliberately not decoded or transferred; photos above are real PNGs.
  text('media/video.mp4', 'synthetic video sentinel');
  text('equipment.csv', 'Name\r\nSynthetic shoes\r\n');
  if (variant === 'missing-manifest') {
    files.delete('activities.csv');
  } else if (variant === 'ambiguous-manifest') {
    text('other/activities.csv', 'Filename\n');
  }

  const writer = new ZipWriter(new Uint8ArrayWriter(), { zip64, useWebWorkers: false });
  for (const [name, bytes] of files) {
    await writer.add(root + name, new Uint8ArrayReader(bytes), { lastModDate: timestamp, extendedTimestamp: false });
  }
  const archive = await writer.close();
  await writeFile(path, variant === 'corrupt' ? archive.slice(0, -16) : archive);
  await utimes(path, timestamp, timestamp);
  return path;
}
