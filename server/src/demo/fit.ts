import { FitBaseType, FitEncoder } from 'fit-file-parser';

import type { ActivityTag, ActivityType } from 'src/types';

const FIT_PROFILE_VERSION = 810;
const FIT_PROTOCOL_VERSION = 0x20;
const SEMICIRCLES_PER_DEGREE = 2 ** 31 / 180;
const EARTH_RADIUS_M = 6_371_000;

type Point = readonly [latitude: number, longitude: number, altitude: number];
type Waypoint = readonly [latitude: number, longitude: number];

const routeAtElevation = (waypoints: readonly Waypoint[], elevationM: number): Point[] =>
  waypoints.map(([latitude, longitude], index) => [
    latitude,
    longitude,
    elevationM + Math.sin(index * 0.71) * 1.5 + Math.sin(index * 0.19) * 0.75,
  ]);

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

const segmentDistance = (before: Point, after: Point) => {
  const latitudeDelta = ((after[0] - before[0]) * Math.PI) / 180;
  const longitudeDelta = ((after[1] - before[1]) * Math.PI) / 180;
  const latitudeA = (before[0] * Math.PI) / 180;
  const latitudeB = (after[0] * Math.PI) / 180;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const interpolateRoute = (route: readonly Point[], ratio: number): Point => {
  let routeDistance = 0;
  for (let index = 1; index < route.length; index++) {
    routeDistance += segmentDistance(route[index - 1], route[index]);
  }
  const targetDistance = Math.min(1, Math.max(0, ratio)) * routeDistance;
  let distanceBefore = 0;
  for (let index = 1; index < route.length; index++) {
    const before = route[index - 1];
    const after = route[index];
    const distance = segmentDistance(before, after);
    if (distanceBefore + distance >= targetDistance || index === route.length - 1) {
      const remainder = distance === 0 ? 0 : (targetDistance - distanceBefore) / distance;
      return [
        before[0] + (after[0] - before[0]) * remainder,
        before[1] + (after[1] - before[1]) * remainder,
        before[2] + (after[2] - before[2]) * remainder,
      ];
    }
    distanceBefore += distance;
  }
  return route.at(-1)!;
};

const activityProgress = (ratio: number) => {
  const variation = Math.sin(ratio * Math.PI * 5) * 0.012 + Math.sin(ratio * Math.PI * 13) * 0.004;
  return Math.min(1, Math.max(0, ratio + variation * ratio * (1 - ratio)));
};

const recordFields = (spec: DemoFitSpec, startedAt: Date, index: number, count: number): FitField[] => {
  const ratio = index / (count - 1);
  const elapsed = Math.round(spec.elapsedTimeS * ratio);
  const progress = activityProgress(ratio);
  const [latitude, longitude, altitude] = interpolateRoute(spec.route, progress);
  const averageSpeed = spec.distanceM / spec.elapsedTimeS;
  const speed = averageSpeed * (1 + Math.sin(ratio * Math.PI * 4) * 0.04 + Math.sin(ratio * Math.PI * 11) * 0.015);
  const heartRate = spec.averageHeartRate + Math.sin(ratio * Math.PI * 2) * 5 + Math.sin(ratio * Math.PI * 7) * 2;
  const cadence = spec.averageCadence + Math.sin(ratio * Math.PI * 6) * 4;
  const power = spec.averagePower > 0 ? spec.averagePower + Math.sin(ratio * Math.PI * 3) * 25 : 0;

  return [
    field(253, FitBaseType.Uint32, fitTimestamp(new Date(startedAt.getTime() + elapsed * 1000))),
    field(0, FitBaseType.Sint32, Math.round(latitude * SEMICIRCLES_PER_DEGREE)),
    field(1, FitBaseType.Sint32, Math.round(longitude * SEMICIRCLES_PER_DEGREE)),
    scaledField(2, FitBaseType.Uint16, altitude + 500, 5),
    scaledField(5, FitBaseType.Uint32, spec.distanceM * progress, 100),
    scaledField(6, FitBaseType.Uint16, speed, 1000),
    field(3, FitBaseType.Uint8, Math.round(heartRate)),
    field(4, FitBaseType.Uint8, Math.round(cadence)),
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
  const recordCount = Math.max(121, Math.floor(spec.elapsedTimeS / 5) + 1);

  encoder.writeMessage(18, sessionFields(spec, startedAt), 0);
  encoder.writeMessage(19, lapFields(spec, startedAt), 1);
  for (let index = 0; index < recordCount; index++) {
    encoder.writeMessage(20, recordFields(spec, startedAt, index, recordCount), 2);
  }

  return encoder.close();
};

// Pedestrian waypoints sampled from the mapped Kungsholmen waterfront route.
const centralStockholm = routeAtElevation(
  [
    [59.329199, 18.068299],
    [59.329368, 18.067717],
    [59.328238, 18.063226],
    [59.328181, 18.06252],
    [59.328245, 18.061408],
    [59.327963, 18.059518],
    [59.328169, 18.057553],
    [59.327827, 18.055157],
    [59.327139, 18.055356],
    [59.327054, 18.05378],
    [59.327193, 18.052926],
    [59.326902, 18.048864],
    [59.326846, 18.042428],
    [59.326883, 18.041618],
    [59.327781, 18.035373],
    [59.328395, 18.034126],
    [59.329033, 18.034274],
    [59.329413, 18.033218],
    [59.330005, 18.032205],
    [59.330531, 18.03217],
    [59.331009, 18.030886],
    [59.331956, 18.03126],
    [59.331964, 18.031207],
    [59.332291, 18.031563],
    [59.3331, 18.033805],
    [59.333581, 18.035357],
    [59.333832, 18.038151],
    [59.333637, 18.039634],
    [59.33312, 18.043614],
    [59.332929, 18.045446],
    [59.332665, 18.047041],
    [59.33233, 18.049611],
    [59.332608, 18.050568],
    [59.332769, 18.050644],
    [59.332176, 18.051196],
    [59.331164, 18.051428],
    [59.33078, 18.052689],
    [59.330112, 18.053487],
    [59.330984, 18.056567],
    [59.331159, 18.057865],
    [59.330684, 18.058969],
    [59.330591, 18.059417],
    [59.329889, 18.060226],
    [59.328513, 18.061471],
    [59.328181, 18.06252],
    [59.328238, 18.063226],
    [59.329368, 18.067717],
    [59.329199, 18.068299],
  ],
  12,
);
const djurgarden: readonly Point[] = [
  [59.3293, 18.0686, 18],
  [59.3269, 18.0758, 17],
  [59.3251, 18.084, 15],
  [59.3244, 18.0937, 14],
  [59.325, 18.102, 14],
  [59.325, 18.112, 14],
  [59.327, 18.1207, 17],
  [59.3302, 18.129, 22],
  [59.333, 18.139, 28],
  [59.3379, 18.138, 30],
  [59.3428, 18.134, 32],
  [59.347, 18.129, 31],
  [59.3488, 18.12, 28],
  [59.349, 18.101, 24],
  [59.342, 18.093, 21],
  [59.336, 18.084, 19],
  [59.3293, 18.0686, 18],
];
const lakeLoop: readonly Point[] = [
  [59.347, 18.101, 22],
  [59.3508, 18.106, 25],
  [59.355, 18.112, 29],
  [59.3594, 18.118, 34],
  [59.363, 18.121, 38],
  [59.367, 18.116, 43],
  [59.3702, 18.108, 48],
  [59.371, 18.096, 52],
  [59.368, 18.087, 47],
  [59.364, 18.079, 40],
  [59.359, 18.071, 31],
  [59.355, 18.076, 28],
  [59.352, 18.084, 25],
  [59.349, 18.092, 23],
  [59.347, 18.101, 22],
];
// Pedestrian waypoints sample the Crissy Field, Golden Gate Promenade, and Presidio trail network.
const sanFranciscoGoldenGate = routeAtElevation(
  [
    [37.806009, -122.431927],
    [37.806849, -122.435048],
    [37.806338, -122.443966],
    [37.806496, -122.443998],
    [37.805496, -122.443875],
    [37.805147, -122.44831],
    [37.805748, -122.452453],
    [37.804673, -122.46111],
    [37.806371, -122.46883],
    [37.807817, -122.470411],
    [37.80882, -122.472204],
    [37.808989, -122.473532],
    [37.808456, -122.471819],
    [37.808213, -122.472451],
    [37.808395, -122.472924],
    [37.808078, -122.472825],
    [37.807703, -122.473355],
    [37.808197, -122.475097],
    [37.808248, -122.475868],
    [37.809343, -122.477181],
    [37.814007, -122.47767],
    [37.808107, -122.476341],
    [37.808046, -122.475312],
    [37.807944, -122.473915],
    [37.806737, -122.47189],
    [37.805866, -122.469982],
    [37.804848, -122.469858],
    [37.803728, -122.468632],
    [37.802861, -122.467162],
    [37.802404, -122.465058],
    [37.80224, -122.463726],
    [37.801451, -122.461619],
    [37.800052, -122.460801],
    [37.799067, -122.462181],
    [37.799444, -122.461572],
    [37.799976, -122.460295],
    [37.801948, -122.457995],
    [37.801792, -122.456542],
    [37.800757, -122.454082],
    [37.800195, -122.452873],
    [37.800129, -122.451323],
    [37.799363, -122.447925],
    [37.799629, -122.44614],
    [37.800851, -122.442931],
    [37.803884, -122.440259],
    [37.804426, -122.43726],
    [37.804985, -122.433615],
    [37.806009, -122.431927],
  ],
  26,
);
// Pedestrian waypoints sampled from Central Park Drive, the Conservancy's six-mile running loop.
const newYorkCentralPark = routeAtElevation(
  [
    [40.768154, -73.981936],
    [40.768483, -73.981419],
    [40.769987, -73.979412],
    [40.7721, -73.976918],
    [40.774391, -73.975612],
    [40.775057, -73.974185],
    [40.77739, -73.974092],
    [40.778769, -73.972963],
    [40.782608, -73.97113],
    [40.785317, -73.969151],
    [40.787932, -73.966966],
    [40.788165, -73.965537],
    [40.788796, -73.964784],
    [40.789216, -73.963007],
    [40.789572, -73.960879],
    [40.789635, -73.959156],
    [40.789505, -73.957913],
    [40.789693, -73.957247],
    [40.790474, -73.956219],
    [40.791098, -73.955354],
    [40.790987, -73.953953],
    [40.792977, -73.952239],
    [40.796696, -73.949742],
    [40.796947, -73.949759],
    [40.796518, -73.949663],
    [40.793607, -73.951747],
    [40.796879, -73.949763],
    [40.797482, -73.948956],
    [40.801459, -73.946051],
    [40.803387, -73.952664],
    [40.803124, -73.956484],
    [40.803285, -73.959307],
    [40.802024, -73.960766],
    [40.800547, -73.962091],
    [40.797915, -73.964019],
    [40.793674, -73.967105],
    [40.791052, -73.969023],
    [40.789066, -73.970458],
    [40.786548, -73.972303],
    [40.784021, -73.974149],
    [40.781941, -73.975669],
    [40.779772, -73.978167],
    [40.7774, -73.978973],
    [40.774907, -73.980795],
    [40.773072, -73.981975],
    [40.771721, -73.982783],
    [40.769075, -73.982338],
    [40.768154, -73.981936],
  ],
  28,
);
const vancouverSeawall: readonly Point[] = [
  [49.288, -123.122, 5],
  [49.29, -123.127, 6],
  [49.292, -123.132, 7],
  [49.291, -123.138, 8],
  [49.286, -123.145, 8],
  [49.281, -123.147, 7],
  [49.274, -123.142, 6],
  [49.269, -123.137, 7],
  [49.267, -123.129, 9],
  [49.268, -123.123, 10],
  [49.274, -123.115, 12],
  [49.28, -123.114, 10],
  [49.284, -123.117, 8],
  [49.288, -123.122, 5],
];
const portlandForestPark: readonly Point[] = [
  [45.538, -122.716, 46],
  [45.542, -122.722, 58],
  [45.547, -122.729, 76],
  [45.551, -122.734, 93],
  [45.557, -122.741, 112],
  [45.564, -122.747, 137],
  [45.57, -122.752, 161],
  [45.577, -122.755, 184],
  [45.584, -122.756, 204],
  [45.59, -122.751, 226],
  [45.596, -122.735, 246],
  [45.592, -122.724, 223],
  [45.586, -122.716, 198],
  [45.579, -122.712, 172],
  [45.571, -122.708, 142],
  [45.563, -122.704, 111],
  [45.555, -122.7, 89],
  [45.548, -122.705, 72],
  [45.542, -122.711, 57],
  [45.538, -122.716, 46],
];
const londonThames: readonly Point[] = [
  [51.507, -0.128, 12],
  [51.509, -0.124, 11],
  [51.51, -0.116, 10],
  [51.509, -0.11, 9],
  [51.505, -0.101, 8],
  [51.501, -0.094, 8],
  [51.498, -0.084, 9],
  [51.494, -0.088, 8],
  [51.491, -0.095, 7],
  [51.491, -0.101, 7],
  [51.493, -0.108, 8],
  [51.496, -0.115, 9],
  [51.496, -0.123, 11],
  [51.5, -0.128, 12],
  [51.504, -0.13, 12],
  [51.507, -0.128, 12],
];
const amsterdamCanals: readonly Point[] = [
  [52.374, 4.894, 2],
  [52.371, 4.894, 2],
  [52.368, 4.893, 1],
  [52.365, 4.891, 1],
  [52.362, 4.886, 2],
  [52.359, 4.882, 3],
  [52.357, 4.879, 3],
  [52.355, 4.884, 2],
  [52.353, 4.891, 1],
  [52.351, 4.9, 1],
  [52.354, 4.906, 1],
  [52.36, 4.914, 2],
  [52.365, 4.914, 2],
  [52.37, 4.912, 1],
  [52.374, 4.91, 1],
  [52.375, 4.903, 2],
  [52.374, 4.894, 2],
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
    startedAt: '2020-01-20T15:05:00.000Z',
    title: 'Island ride',
    description: 'Cold afternoon but beautiful sunset.',
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
  {
    slug: 'golden-gate-intervals',
    filename: 'golden-gate-intervals.fit',
    startedAt: '2026-08-10T15:35:00.000Z',
    title: 'Golden Gate intervals',
    description: 'Short, sharp efforts with the bay opening up at every turn.',
    activitySport: 'run',
    tags: ['workout'],
    distanceM: 10_800,
    elapsedTimeS: 3120,
    elevationGainM: 238,
    elevationLossM: 231,
    averageHeartRate: 161,
    maximumHeartRate: 188,
    averageCadence: 179,
    maximumCadence: 198,
    averagePower: 0,
    maximumPower: 0,
    calories: 742,
    route: sanFranciscoGoldenGate,
  },
  {
    slug: 'central-park-progression',
    filename: 'central-park-progression.fit',
    startedAt: '2026-08-07T11:10:00.000Z',
    title: 'Central Park progression',
    description: 'Easy laps that gradually turned into a proper city tempo.',
    activitySport: 'run',
    tags: ['workout'],
    distanceM: 14_600,
    elapsedTimeS: 4380,
    elevationGainM: 116,
    elevationLossM: 112,
    averageHeartRate: 154,
    maximumHeartRate: 181,
    averageCadence: 174,
    maximumCadence: 190,
    averagePower: 0,
    maximumPower: 0,
    calories: 968,
    route: newYorkCentralPark,
  },
  {
    slug: 'seawall-sunrise-ride',
    filename: 'seawall-sunrise-ride.fit',
    startedAt: '2026-08-03T13:20:00.000Z',
    title: 'Seawall sunrise ride',
    description: 'A calm spin around the harbour before the mountains warmed up.',
    activitySport: 'ride',
    tags: ['recovery'],
    distanceM: 32_400,
    elapsedTimeS: 5220,
    elevationGainM: 148,
    elevationLossM: 145,
    averageHeartRate: 132,
    maximumHeartRate: 158,
    averageCadence: 88,
    maximumCadence: 106,
    averagePower: 176,
    maximumPower: 388,
    calories: 874,
    route: vancouverSeawall,
  },
  {
    slug: 'wildwood-climb',
    filename: 'wildwood-climb.fit',
    startedAt: '2026-07-29T16:45:00.000Z',
    title: 'Wildwood climb',
    description: 'A shaded forest climb with muddy shoes and a fast descent home.',
    activitySport: 'trail_run',
    tags: ['long_run'],
    distanceM: 16_900,
    elapsedTimeS: 6060,
    elevationGainM: 486,
    elevationLossM: 479,
    averageHeartRate: 148,
    maximumHeartRate: 179,
    averageCadence: 166,
    maximumCadence: 184,
    averagePower: 0,
    maximumPower: 0,
    calories: 1198,
    route: portlandForestPark,
  },
  {
    slug: 'thames-evening-ride',
    filename: 'thames-evening-ride.fit',
    startedAt: '2026-07-24T18:25:00.000Z',
    title: 'Thames evening ride',
    description: 'Bridges, river light, and a steady wheel through the evening commute.',
    activitySport: 'ride',
    tags: ['commute'],
    distanceM: 27_300,
    elapsedTimeS: 4680,
    elevationGainM: 92,
    elevationLossM: 89,
    averageHeartRate: 136,
    maximumHeartRate: 164,
    averageCadence: 84,
    maximumCadence: 101,
    averagePower: 164,
    maximumPower: 354,
    calories: 721,
    route: londonThames,
  },
  {
    slug: 'canal-recovery-spin',
    filename: 'canal-recovery-spin.fit',
    startedAt: '2026-07-20T08:40:00.000Z',
    title: 'Canal recovery spin',
    description: 'Flat streets, quiet canals, and exactly the effort the legs needed.',
    activitySport: 'ride',
    tags: ['recovery'],
    distanceM: 22_700,
    elapsedTimeS: 4140,
    elevationGainM: 38,
    elevationLossM: 35,
    averageHeartRate: 124,
    maximumHeartRate: 146,
    averageCadence: 91,
    maximumCadence: 104,
    averagePower: 142,
    maximumPower: 286,
    calories: 548,
    route: amsterdamCanals,
  },
];
