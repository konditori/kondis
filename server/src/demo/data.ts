import {
  amsterdamCanals,
  centralStockholm,
  djurgarden,
  lidingo,
  londonThames,
  newYorkCentralPark,
  portlandForestPark,
  sanFranciscoGoldenGate,
  singapore,
  vancouverSeawall,
} from 'src/demo/routes';
import { ActivityType } from 'src/enum';
import type { ActivityMetrics, ActivityStreamInput, ActivityTag } from 'src/types';
import { haversineDistance } from 'src/utils/geo';

export const JOHN_EMAIL = 'john@kondis.org';
export const SOFIA_EMAIL = 'sofia@kondis.org';
export const MARCUS_EMAIL = 'marcus@kondis.org';
export const DEMO_PASSWORD_HASH = '$2b$12$q5KRFbq3UirFSlEhM7Xa.uoi96PRJvpMz4b6UPvN4clsmqB0VxfGW';
export const DEMO_IMAGE_MIME_TYPE = 'image/jpeg';
export const DEMO_SESSION_TOKEN_HASH = '9b95c4cbc655cd99db0b02ec50991d59c06c6c3c19aaaea7618ddef8e9b5e73a';

export const demoFixtureId = (kind: number, index: number): string =>
  `00000000-0000-4000-8000-${String(kind * 100 + index + 1).padStart(12, '0')}`;

export const DEMO_SESSION_ID = demoFixtureId(9, 0);

export const DEMO_USER_CONFIGS = [
  {
    id: demoFixtureId(1, 0),
    email: JOHN_EMAIL,
    role: 'admin',
    first_name: 'John',
    last_name: 'Doe',
    avatar_path: 'avatars/john-doe.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 144_935,
  },
  {
    id: demoFixtureId(1, 1),
    email: SOFIA_EMAIL,
    role: 'user',
    first_name: 'Sofia',
    last_name: 'Berg',
    avatar_path: 'avatars/sofia-berg.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 168_522,
  },
  {
    id: demoFixtureId(1, 2),
    email: MARCUS_EMAIL,
    role: 'user',
    first_name: 'Marcus',
    last_name: 'Lee',
    avatar_path: 'avatars/marcus-lee.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 100_841,
  },
] as const;

export type Point = readonly [latitude: number, longitude: number, altitude: number];
export type DemoFitSpec = {
  slug: string;
  startedAt: string;
  title: string;
  description: string;
  activitySport: ActivityType;
  tags: ActivityTag[];
  elapsedTimeS: number;
  averageHeartRate: number;
  maximumHeartRate: number;
  averageCadence: number;
  maximumCadence: number;
  averagePower: number;
  maximumPower: number;
  calories: number;
  route: readonly Point[];
};

export type DemoActivityData = {
  metrics: ActivityMetrics;
  streams: ActivityStreamInput[];
  laps: {
    lap_index: number;
    started_at: Date;
    elapsed_time: number;
    moving_time: number;
    distance: number;
    avg_hr: number;
    max_hr: number;
    avg_power: number;
    avg_speed_mps: number;
  }[];
};

const demoActivityProgress = (ratio: number): number => {
  const variation = Math.sin(ratio * Math.PI * 5) * 0.012 + Math.sin(ratio * Math.PI * 13) * 0.004;
  return Math.min(1, Math.max(0, ratio + variation * ratio * (1 - ratio)));
};

const interpolateDemoRoute = (route: readonly Point[], ratio: number): Point => {
  const distances = route.slice(1).map((point, index) => {
    const before = route[index];
    return haversineDistance(before[0], before[1], point[0], point[1]);
  });
  const totalDistance = distances.reduce((total, distance) => total + distance, 0);
  const targetDistance = Math.min(1, Math.max(0, ratio)) * totalDistance;
  let distanceBefore = 0;
  for (let index = 1; index < route.length; index++) {
    const distance = distances[index - 1];
    if (distanceBefore + distance >= targetDistance || index === route.length - 1) {
      const before = route[index - 1];
      const after = route[index];
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

export const createDemoActivityData = (spec: DemoFitSpec): DemoActivityData => {
  const startedAt = new Date(spec.startedAt);
  let distanceM = 0;
  let elevationGainM = 0;
  let elevationLossM = 0;
  for (let index = 1; index < spec.route.length; index += 1) {
    const previous = spec.route[index - 1]!;
    const point = spec.route[index]!;
    distanceM += haversineDistance(previous[0], previous[1], point[0], point[1]);
    const elevationChange = point[2] - previous[2];
    if (elevationChange > 0) {
      elevationGainM += elevationChange;
    } else {
      elevationLossM -= elevationChange;
    }
  }
  const recordCount = Math.max(121, Math.floor(spec.elapsedTimeS / 5) + 1);
  const data: Record<ActivityStreamInput['type'], number[]> = {
    time: [],
    latitude: [],
    longitude: [],
    altitude: [],
    distance: [],
    speed: [],
    heartrate: [],
    cadence: [],
    power: [],
    temperature: [],
  };

  for (let index = 0; index < recordCount; index++) {
    const ratio = index / (recordCount - 1);
    const elapsed = Math.round(spec.elapsedTimeS * ratio);
    const progress = demoActivityProgress(ratio);
    const [latitude, longitude, altitude] = interpolateDemoRoute(spec.route, progress);
    const averageSpeed = distanceM / spec.elapsedTimeS;
    data.time.push(elapsed);
    data.latitude.push(latitude);
    data.longitude.push(longitude);
    data.altitude.push(altitude);
    data.distance.push(distanceM * progress);
    data.speed.push(averageSpeed * (1 + Math.sin(ratio * Math.PI * 4) * 0.04 + Math.sin(ratio * Math.PI * 11) * 0.015));
    data.heartrate.push(spec.averageHeartRate + Math.sin(ratio * Math.PI * 2) * 5 + Math.sin(ratio * Math.PI * 7) * 2);
    data.cadence.push(spec.averageCadence + Math.sin(ratio * Math.PI * 6) * 4);
    data.power.push(spec.averagePower > 0 ? spec.averagePower + Math.sin(ratio * Math.PI * 3) * 25 : 0);
    data.temperature.push(12 - altitude / 100);
  }

  const averageSpeed = distanceM / spec.elapsedTimeS;
  return {
    metrics: {
      elapsed_time: spec.elapsedTimeS,
      moving_time: spec.elapsedTimeS - 30,
      distance: distanceM,
      elevation_gain: elevationGainM,
      elevation_loss: elevationLossM,
      avg_speed: averageSpeed,
      max_speed: averageSpeed * 1.25,
      avg_hr: spec.averageHeartRate,
      max_hr: spec.maximumHeartRate,
      avg_cadence: spec.averageCadence,
      max_cadence: spec.maximumCadence,
      avg_power: spec.averagePower,
      max_power: spec.maximumPower,
      normalized_power: spec.averagePower > 0 ? spec.averagePower + 10 : 0,
      calories: spec.calories,
    },
    streams: Object.entries(data).map(([type, values]) => ({
      type: type as ActivityStreamInput['type'],
      data: values,
    })),
    laps: [
      {
        lap_index: 0,
        started_at: startedAt,
        elapsed_time: spec.elapsedTimeS,
        moving_time: spec.elapsedTimeS - 30,
        distance: distanceM,
        avg_hr: spec.averageHeartRate,
        max_hr: spec.maximumHeartRate,
        avg_power: spec.averagePower,
        avg_speed_mps: averageSpeed,
      },
    ],
  };
};

export type DemoCommentConfig = {
  userEmail: string;
  body: string;
};

export const DEMO_ACTIVITY_COMMENTS: Record<string, readonly DemoCommentConfig[]> = {
  'golden-hour-trail': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'That light is worth the early alarm. The loop looks perfect.',
    },
    {
      userEmail: 'john@kondis.org',
      body: 'It really was. The legs felt better than expected too.',
    },
  ],
  'city-tempo': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'The middle three kilometres look properly spicy. Nice pacing.',
    },
  ],
  'island-ride': [
    {
      userEmail: 'john@kondis.org',
      body: 'Cold hands, warm sunset. That is a pretty good trade.',
    },
  ],
  'gravel-after-work': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'Did the final climb feel as fast as it looks?',
    },
    {
      userEmail: 'john@kondis.org',
      body: 'Somehow, yes. The dusty descent made up for the first half.',
    },
  ],
  'long-sunday-run': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'This is exactly the kind of run that makes Monday feel easier.',
    },
  ],
  'park-walk': [
    {
      userEmail: 'john@kondis.org',
      body: 'A very good choice after a long day. The park looks peaceful.',
    },
  ],
  'golden-gate-intervals': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'Short and sharp is right. Those efforts add up quickly.',
    },
  ],
  'central-park-progression': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'The best kind of progression: relaxed enough at the start to enjoy it.',
    },
  ],
  'seawall-sunrise-ride': [
    {
      userEmail: 'john@kondis.org',
      body: 'That is a beautiful way to start the day. Smooth route, too.',
    },
  ],
  'wildwood-climb': [
    {
      userEmail: 'sofia@kondis.org',
      body: 'Muddy shoes and a fast descent is a solid day out.',
    },
  ],
  'thames-evening-ride': [
    {
      userEmail: 'marcus@kondis.org',
      body: 'The river light must have been excellent on this one.',
    },
  ],
  'canal-recovery-spin': [
    {
      userEmail: 'john@kondis.org',
      body: 'Exactly the right amount of effort for a recovery day.',
    },
  ],
};

export const DEMO_FIT_SPECS: readonly DemoFitSpec[] = [
  {
    slug: 'golden-hour-trail',
    startedAt: '2026-08-29T05:42:00.000Z',
    title: 'Golden hour trail run',
    description: 'A quiet loop before the city woke up.',
    activitySport: ActivityType.TrailRun,
    tags: ['long_run'],
    elapsedTimeS: 3980,
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
    startedAt: '2026-08-25T16:20:00.000Z',
    title: 'City tempo',
    description: 'Three bright kilometres in the middle, easy home.',
    activitySport: ActivityType.Run,
    tags: ['workout'],
    elapsedTimeS: 2640,
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
    startedAt: '2020-01-20T15:05:00.000Z',
    title: 'Island ride',
    description: 'Cold afternoon but beautiful sunset.',
    activitySport: ActivityType.Ride,
    tags: ['commute'],
    elapsedTimeS: 6720,
    averageHeartRate: 143,
    maximumHeartRate: 171,
    averageCadence: 86,
    maximumCadence: 104,
    averagePower: 188,
    maximumPower: 426,
    calories: 1124,
    route: lidingo,
  },
  {
    slug: 'gravel-after-work',
    startedAt: '2026-08-19T17:40:00.000Z',
    title: 'Gravel after work',
    description: 'Dusty paths and a surprisingly fast final climb.',
    activitySport: ActivityType.GravelRide,
    tags: ['workout'],
    elapsedTimeS: 5040,
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
    startedAt: '2026-08-16T07:15:00.000Z',
    title: 'Long Sunday run',
    description: 'A patient, conversational long run by the water.',
    activitySport: ActivityType.Run,
    tags: ['long_run'],
    elapsedTimeS: 5940,
    averageHeartRate: 146,
    maximumHeartRate: 169,
    averageCadence: 168,
    maximumCadence: 181,
    averagePower: 0,
    maximumPower: 0,
    calories: 1176,
    route: singapore,
  },
  {
    slug: 'park-walk',
    startedAt: '2026-08-12T18:10:00.000Z',
    title: 'Park walk',
    description: 'An easy reset after a long day.',
    activitySport: ActivityType.Hike,
    tags: ['recovery'],
    elapsedTimeS: 5100,
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
    startedAt: '2026-08-10T15:35:00.000Z',
    title: 'Golden Gate intervals',
    description: 'Short, sharp efforts with the bay opening up at every turn.',
    activitySport: ActivityType.Run,
    tags: ['workout'],
    elapsedTimeS: 3120,
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
    startedAt: '2026-08-07T11:10:00.000Z',
    title: 'Central Park progression',
    description: 'Easy laps that gradually turned into a proper city tempo.',
    activitySport: ActivityType.Run,
    tags: ['workout'],
    elapsedTimeS: 4380,
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
    startedAt: '2026-08-03T13:20:00.000Z',
    title: 'Seawall sunrise ride',
    description: 'A calm spin around the harbour before the mountains warmed up.',
    activitySport: ActivityType.Ride,
    tags: ['recovery'],
    elapsedTimeS: 5220,
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
    startedAt: '2026-07-29T16:45:00.000Z',
    title: 'Wildwood climb',
    description: 'A shaded forest climb with muddy shoes and a fast descent home.',
    activitySport: ActivityType.TrailRun,
    tags: ['long_run'],
    elapsedTimeS: 6060,
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
    startedAt: '2026-07-24T18:25:00.000Z',
    title: 'Thames evening ride',
    description: 'Bridges, river light, and a steady wheel through the evening commute.',
    activitySport: ActivityType.Ride,
    tags: ['commute'],
    elapsedTimeS: 4680,
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
    startedAt: '2026-07-20T08:40:00.000Z',
    title: 'Canal recovery spin',
    description: 'Flat streets, quiet canals, and exactly the effort the legs needed.',
    activitySport: ActivityType.Ride,
    tags: ['recovery'],
    elapsedTimeS: 4140,
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
