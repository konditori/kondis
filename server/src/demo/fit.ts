import { FitBaseType, FitEncoder } from 'fit-file-parser';

import type { ActivityTag, ActivityType } from 'src/types';

const FIT_PROFILE_VERSION = 810;
const FIT_PROTOCOL_VERSION = 0x20;
const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;

type Point = readonly [latitude: number, longitude: number, altitude: number];

export type DemoFitSpec = {
  slug: string;
  filename: string;
  startedAt: string;
  title: string;
  description: string;
  activitySport: ActivityType;
  tags: ActivityTag[];
  distanceM: number;
  elapsedTimeS: number;
  elevationGainM: number;
  elevationLossM: number;
  averageHeartRate: number;
  maximumHeartRate: number;
  averageCadence: number;
  maximumCadence: number;
  averagePower: number;
  maximumPower: number;
  calories: number;
  route: readonly Point[];
};

type FitField = {
  number: number;
  size: number;
  baseType: FitBaseType;
  value: number;
};

const field = (number: number, baseType: FitBaseType, value: number): FitField => ({
  number,
  size: baseType === FitBaseType.Uint32 || baseType === FitBaseType.Sint32 ? 4 : baseType >= 128 ? 2 : 1,
  baseType,
  value,
});

const scaledField = (number: number, baseType: FitBaseType, value: number, scale: number): FitField =>
  field(number, baseType, Math.round(value * scale));

const fitSport = (sport: ActivityType): { sport: number; subSport: number } => {
  if (sport === 'trail_run') {
    return { sport: 1, subSport: 3 };
  }
  if (sport === 'run') {
    return { sport: 1, subSport: 0 };
  }
  if (sport === 'ride' || sport === 'gravel_ride') {
    return { sport: 2, subSport: sport === 'gravel_ride' ? 11 : 7 };
  }
  return { sport: 17, subSport: 0 };
};

const fitTimestamp = (date: Date): number => FitEncoder.toFitTimestamp(date);

const interpolateRoute = (route: readonly Point[], ratio: number): Point => {
  const position = Math.min(0.999999, Math.max(0, ratio)) * (route.length - 1);
  const index = Math.floor(position);
  const remainder = position - index;
  const before = route[index];
  const after = route[Math.min(route.length - 1, index + 1)];
  return [
    before[0] + (after[0] - before[0]) * remainder,
    before[1] + (after[1] - before[1]) * remainder,
    before[2] + (after[2] - before[2]) * remainder,
  ];
};

const recordFields = (spec: DemoFitSpec, startedAt: Date, index: number, count: number): FitField[] => {
  const ratio = index / (count - 1);
  const elapsed = Math.round(spec.elapsedTimeS * ratio);
  const [latitude, longitude, altitude] = interpolateRoute(spec.route, ratio);
  const averageSpeed = spec.distanceM / spec.elapsedTimeS;
  const speed = averageSpeed * (1 + Math.sin(ratio * Math.PI * 4) * 0.06);
  const power = spec.averagePower > 0 ? spec.averagePower + Math.sin(ratio * Math.PI * 3) * 25 : 0;

  return [
    field(253, FitBaseType.Uint32, fitTimestamp(new Date(startedAt.getTime() + elapsed * 1000))),
    field(0, FitBaseType.Sint32, Math.round(latitude * SEMICIRCLES_PER_DEGREE)),
    field(1, FitBaseType.Sint32, Math.round(longitude * SEMICIRCLES_PER_DEGREE)),
    scaledField(2, FitBaseType.Uint16, altitude + 500, 5),
    scaledField(5, FitBaseType.Uint32, spec.distanceM * ratio, 100),
    scaledField(6, FitBaseType.Uint16, speed, 1000),
    field(3, FitBaseType.Uint8, Math.round(spec.averageHeartRate + Math.sin(ratio * Math.PI * 2) * 5)),
    field(4, FitBaseType.Uint8, spec.averageCadence),
    field(7, FitBaseType.Uint16, Math.max(0, Math.round(power))),
    field(13, FitBaseType.Sint8, Math.round(12 - altitude / 100)),
  ];
};

const sessionFields = (spec: DemoFitSpec, startedAt: Date): FitField[] => {
  const { sport, subSport } = fitSport(spec.activitySport);
  return [
    field(2, FitBaseType.Uint32, fitTimestamp(startedAt)),
    scaledField(7, FitBaseType.Uint32, spec.elapsedTimeS, 1000),
    scaledField(8, FitBaseType.Uint32, spec.elapsedTimeS - 30, 1000),
    scaledField(9, FitBaseType.Uint32, spec.distanceM, 100),
    field(22, FitBaseType.Uint16, spec.elevationGainM),
    field(23, FitBaseType.Uint16, spec.elevationLossM),
    scaledField(14, FitBaseType.Uint16, spec.distanceM / spec.elapsedTimeS, 1000),
    scaledField(15, FitBaseType.Uint16, (spec.distanceM / spec.elapsedTimeS) * 1.25, 1000),
    field(16, FitBaseType.Uint8, spec.averageHeartRate),
    field(17, FitBaseType.Uint8, spec.maximumHeartRate),
    field(18, FitBaseType.Uint8, spec.averageCadence),
    field(19, FitBaseType.Uint8, spec.maximumCadence),
    field(20, FitBaseType.Uint16, spec.averagePower),
    field(21, FitBaseType.Uint16, spec.maximumPower),
    field(34, FitBaseType.Uint16, spec.averagePower > 0 ? spec.averagePower + 10 : 0),
    field(11, FitBaseType.Uint16, spec.calories),
    field(5, FitBaseType.Enum, sport),
    field(6, FitBaseType.Enum, subSport),
  ];
};

const lapFields = (spec: DemoFitSpec, startedAt: Date): FitField[] => [
  field(2, FitBaseType.Uint32, fitTimestamp(startedAt)),
  scaledField(7, FitBaseType.Uint32, spec.elapsedTimeS, 1000),
  scaledField(8, FitBaseType.Uint32, spec.elapsedTimeS - 30, 1000),
  scaledField(9, FitBaseType.Uint32, spec.distanceM, 100),
  field(15, FitBaseType.Uint8, spec.averageHeartRate),
  field(16, FitBaseType.Uint8, spec.maximumHeartRate),
  scaledField(13, FitBaseType.Uint16, spec.distanceM / spec.elapsedTimeS, 1000),
  scaledField(14, FitBaseType.Uint16, (spec.distanceM / spec.elapsedTimeS) * 1.25, 1000),
];

export const createDemoFitFile = (spec: DemoFitSpec): Uint8Array => {
  const startedAt = new Date(spec.startedAt);
  const encoder = new FitEncoder({ protocolVersion: FIT_PROTOCOL_VERSION, profileVersion: FIT_PROFILE_VERSION });
  const recordCount = Math.max(61, Math.floor(spec.elapsedTimeS / 30) + 1);

  encoder.writeMessage(18, sessionFields(spec, startedAt), 0);
  encoder.writeMessage(19, lapFields(spec, startedAt), 1);
  for (let index = 0; index < recordCount; index++) {
    encoder.writeMessage(20, recordFields(spec, startedAt, index, recordCount), 2);
  }

  return encoder.close();
};

// These routes are intentionally fictional but geographically plausible, so the public demo is useful without
// exposing anyone's personal activity history.
const centralStockholm: readonly Point[] = [
  [59.3293, 18.0686, 18],
  [59.335, 18.091, 25],
  [59.348, 18.102, 42],
  [59.356, 18.078, 30],
  [59.343, 18.056, 16],
  [59.3293, 18.0686, 18],
];
const djurgarden: readonly Point[] = [
  [59.3293, 18.0686, 18],
  [59.325, 18.112, 14],
  [59.333, 18.139, 28],
  [59.347, 18.129, 31],
  [59.349, 18.101, 24],
  [59.3293, 18.0686, 18],
];
const lakeLoop: readonly Point[] = [
  [59.347, 18.101, 22],
  [59.363, 18.121, 38],
  [59.371, 18.096, 52],
  [59.359, 18.071, 31],
  [59.347, 18.101, 22],
];

export const DEMO_FIT_SPECS: readonly DemoFitSpec[] = [
  {
    slug: 'golden-hour-trail',
    filename: 'golden-hour-trail.fit',
    startedAt: '2026-08-29T05:42:00.000Z',
    title: 'Golden hour trail run',
    description: 'A quiet loop before the city woke up.',
    activitySport: 'trail_run',
    tags: ['long_run'],
    distanceM: 12_420,
    elapsedTimeS: 3980,
    elevationGainM: 184,
    elevationLossM: 181,
    averageHeartRate: 151,
    maximumHeartRate: 178,
    averageCadence: 171,
    maximumCadence: 186,
    averagePower: 0,
    maximumPower: 0,
    calories: 812,
    route: djurgarden,
  },
  {
    slug: 'city-tempo',
    filename: 'city-tempo.fit',
    startedAt: '2026-08-25T16:20:00.000Z',
    title: 'City tempo',
    description: 'Three bright kilometres in the middle, easy home.',
    activitySport: 'run',
    tags: ['workout'],
    distanceM: 8650,
    elapsedTimeS: 2640,
    elevationGainM: 64,
    elevationLossM: 62,
    averageHeartRate: 158,
    maximumHeartRate: 184,
    averageCadence: 176,
    maximumCadence: 191,
    averagePower: 0,
    maximumPower: 0,
    calories: 594,
    route: centralStockholm,
  },
  {
    slug: 'island-ride',
    filename: 'island-ride.fit',
    startedAt: '2026-08-23T08:05:00.000Z',
    title: 'Island ride',
    description: 'Smooth roads, warm coffee, no rush.',
    activitySport: 'ride',
    tags: ['commute'],
    distanceM: 41_800,
    elapsedTimeS: 6720,
    elevationGainM: 312,
    elevationLossM: 305,
    averageHeartRate: 143,
    maximumHeartRate: 171,
    averageCadence: 86,
    maximumCadence: 104,
    averagePower: 188,
    maximumPower: 426,
    calories: 1124,
    route: lakeLoop,
  },
  {
    slug: 'gravel-after-work',
    filename: 'gravel-after-work.fit',
    startedAt: '2026-08-19T17:40:00.000Z',
    title: 'Gravel after work',
    description: 'Dusty paths and a surprisingly fast final climb.',
    activitySport: 'gravel_ride',
    tags: ['workout'],
    distanceM: 28_600,
    elapsedTimeS: 5040,
    elevationGainM: 428,
    elevationLossM: 423,
    averageHeartRate: 149,
    maximumHeartRate: 178,
    averageCadence: 82,
    maximumCadence: 101,
    averagePower: 205,
    maximumPower: 502,
    calories: 938,
    route: djurgarden,
  },
  {
    slug: 'long-sunday-run',
    filename: 'long-sunday-run.fit',
    startedAt: '2026-08-16T07:15:00.000Z',
    title: 'Long Sunday run',
    description: 'A patient, conversational long run by the water.',
    activitySport: 'run',
    tags: ['long_run', 'recovery'],
    distanceM: 18_200,
    elapsedTimeS: 5940,
    elevationGainM: 126,
    elevationLossM: 124,
    averageHeartRate: 146,
    maximumHeartRate: 169,
    averageCadence: 168,
    maximumCadence: 181,
    averagePower: 0,
    maximumPower: 0,
    calories: 1176,
    route: lakeLoop,
  },
  {
    slug: 'park-walk',
    filename: 'park-walk.fit',
    startedAt: '2026-08-12T18:10:00.000Z',
    title: 'Park walk',
    description: 'An easy reset after a long day.',
    activitySport: 'hike',
    tags: ['recovery'],
    distanceM: 6300,
    elapsedTimeS: 5100,
    elevationGainM: 72,
    elevationLossM: 70,
    averageHeartRate: 104,
    maximumHeartRate: 128,
    averageCadence: 112,
    maximumCadence: 126,
    averagePower: 0,
    maximumPower: 0,
    calories: 362,
    route: centralStockholm,
  },
];
