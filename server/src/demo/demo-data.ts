import {
  amsterdam,
  djurgarden,
  lidingo,
  london,
  newYorkCentralPark as manhattan,
  munksjon,
  portland,
  sanFranciscoGoldenGate as sanfrancisco,
  scania,
  singapore,
  vancouver,
} from 'src/demo/demo-routes';
import { ActivityType, UserRole } from 'src/enum';
import type { ActivityTag } from 'src/types';

export const JOHN_EMAIL = 'john@kondis.org';
export const SOFIA_EMAIL = 'sofia@kondis.org';
export const MARCUS_EMAIL = 'marcus@kondis.org';
export const EMMA_EMAIL = 'emma@kondis.org';
export const LUCAS_EMAIL = 'lucas@kondis.org';
export const MAYA_EMAIL = 'maya@kondis.org';
export const OSCAR_EMAIL = 'oscar@kondis.org';
export const DEMO_PASSWORD_HASH = '$2b$12$q5KRFbq3UirFSlEhM7Xa.uoi96PRJvpMz4b6UPvN4clsmqB0VxfGW';
export const DEMO_IMAGE_MIME_TYPE = 'image/jpeg';
export const DEMO_SESSION_TOKEN_HASH = '9b95c4cbc655cd99db0b02ec50991d59c06c6c3c19aaaea7618ddef8e9b5e73a';

export const JOHN_USER_ID = 'ba663906-e135-4871-991f-d7d658bcd49b';
export const SOFIA_USER_ID = 'd0efab08-6d31-4dc9-8391-0b9919fd5e64';
export const MARCUS_USER_ID = 'd71a83bd-7779-4a4e-935b-8a44cb884bff';
export const EMMA_USER_ID = 'cd13e2b4-15d5-4c18-91e1-06544e2e78d1';
export const LUCAS_USER_ID = '146b2fd7-0d29-4da0-bc42-03f171569936';
export const MAYA_USER_ID = '8601f9c8-a5c3-4f6f-a739-afdfb35d3339';
export const OSCAR_USER_ID = '207b3846-fe3e-4b67-9c15-22474bffff3b';

export const SESSION_ID = 'efa9a38a-8ab2-423c-9dae-3da400c4aa32';

export const DEMO_UPLOAD_IDS: Readonly<Record<string, string>> = {
  djurgarden: '9a1eb0fc-0492-437b-8704-afca07d3c72b',
  'monk-lake-5k': 'ed157218-2100-4e7a-85f7-f2f72f6cace0',
  'island-ride': '24d7400c-707e-44d9-8c73-02450de38c52',
  'gravel-after-work': '0eee9448-fb31-4567-be84-0173d5be9569',
  'long-sunday-run': '7c5af3ae-bbfc-430b-aecd-ed5439f6a3fc',
  'park-walk': 'c83a95d0-e798-4f2e-9e95-3681d4ea4bba',
  'golden-gate-intervals': '2b9fa2b5-d3d2-41a6-ab27-3e6ed1c511fb',
  'central-park-progression': '3e6e3b7a-fcbd-46ea-8dc2-42ecef45a62f',
  'seawall-sunrise-ride': '7b269bee-5e03-4950-bc29-df001b2355c7',
  'wildwood-climb': '1c86f2fb-2024-4a40-bd37-24d3c6b276d7',
  'thames-evening-ride': '2f43e961-97db-45e4-af5c-16b4c4a383d3',
  'canal-recovery-spin': 'ee92853f-28f7-4bac-9e0b-907c781ef192',
};

export const DEMO_ACTIVITY_IDS: Readonly<Record<string, string>> = {
  djurgarden: '3477bfb0-163e-4a9c-a68e-802e77297a0d',
  'monk-lake-5k': 'f1b1ad97-8224-4379-b0f3-31bfc0f4d874',
  'island-ride': '8a5b3577-e0ea-430d-b9c4-c7c6fb32b477',
  'gravel-after-work': '7e0092cf-15ba-43c5-abf2-96e811977be3',
  'long-sunday-run': '24bbf3fd-09e7-4828-8d6d-e898b3dd034b',
  'park-walk': '05581265-5bce-40a6-a07b-54e9bd459126',
  'golden-gate-intervals': 'd1797595-ac0e-4631-9936-772470ad5252',
  'central-park-progression': '3f2f5d81-3de0-4f57-a3cd-0c5dfa09548d',
  'seawall-sunrise-ride': '6cf28b8e-5549-4472-b74d-481423f76263',
  'wildwood-climb': '4b125ced-1945-4abd-97c8-c813f3c6297f',
  'thames-evening-ride': '8dfe7463-445e-49b4-ad6e-7843bdab618d',
  'canal-recovery-spin': 'fab6ae33-4311-4497-b9f0-a0ae9e1ba045',
};

export const DEMO_ACTIVITY_IMAGE_IDS: Readonly<Record<string, readonly string[]>> = {
  'island-ride': ['e69ea55a-f17b-4651-8484-b9d89829bf99'],
  'gravel-after-work': ['f6ee81cb-1041-4ffd-9283-293fd5ead3d6'],
  'long-sunday-run': ['0f1f542a-b2a6-4d73-b529-2ece22828139'],
  'park-walk': ['54d95f1d-3653-4bb5-8ae3-192f1661c4b3'],
  'golden-gate-intervals': ['e3baa887-bdd2-4131-a072-47abf5d71237', '0bf70afc-d2cc-4030-8d87-8f13e3cf1e86'],
  'central-park-progression': ['1d1ef8fb-fc75-4364-b6cb-55ee7ac9793d'],
  'seawall-sunrise-ride': ['e78d2a76-3eb3-4186-ae11-86c05ffef164'],
  'wildwood-climb': ['b92572a0-080d-4444-9490-b777eaeaa472'],
  'thames-evening-ride': ['dd31342e-9d31-4436-b187-9e5fc3ec1b8b'],
  'canal-recovery-spin': ['a0009138-1a18-4676-bfcc-58088069cb73'],
};

export const DEMO_USERS = [
  {
    id: JOHN_USER_ID,
    email: JOHN_EMAIL,
    role: UserRole.Admin,
    first_name: 'John',
    last_name: 'Doe',
    follows: [SOFIA_USER_ID, MARCUS_USER_ID, EMMA_USER_ID, LUCAS_USER_ID, MAYA_USER_ID, OSCAR_USER_ID],
    avatar_path: 'avatars/john-doe.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 144_935,
  },
  {
    id: SOFIA_USER_ID,
    email: SOFIA_EMAIL,
    role: UserRole.User,
    first_name: 'Sofia',
    last_name: 'Berg',
    follows: [JOHN_USER_ID, MARCUS_USER_ID],
    avatar_path: 'avatars/sofia-berg.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 168_522,
  },
  {
    id: MARCUS_USER_ID,
    email: MARCUS_EMAIL,
    role: UserRole.User,
    first_name: 'Marcus',
    last_name: 'Lee',
    follows: [JOHN_USER_ID, SOFIA_USER_ID],
    avatar_path: 'avatars/marcus-lee.jpg',
    avatar_mime_type: DEMO_IMAGE_MIME_TYPE,
    avatar_size: 100_841,
  },
  {
    id: EMMA_USER_ID,
    email: EMMA_EMAIL,
    role: UserRole.User,
    first_name: 'Emma',
    last_name: 'Lind',
    follows: [JOHN_USER_ID, SOFIA_USER_ID],
  },
  {
    id: LUCAS_USER_ID,
    email: LUCAS_EMAIL,
    role: UserRole.User,
    first_name: 'Lucas',
    last_name: 'Nilsson',
    follows: [MARCUS_USER_ID, EMMA_USER_ID, SOFIA_USER_ID],
  },
  {
    id: MAYA_USER_ID,
    email: MAYA_EMAIL,
    role: UserRole.User,
    first_name: 'Maya',
    last_name: 'Sund',
    follows: [EMMA_USER_ID, LUCAS_USER_ID, SOFIA_USER_ID],
  },
  {
    id: OSCAR_USER_ID,
    email: OSCAR_EMAIL,
    role: UserRole.User,
    first_name: 'Oscar',
    last_name: 'Bergman',
    follows: [],
  },
] as const;

export type Point = readonly [latitude: number, longitude: number, altitude: number];

export type DemoActivity = {
  id: string;
  slug: string;
  imageFiles: readonly string[];
  comments: readonly DemoCommentConfig[];
  likes: readonly string[];
  startedAt: Date;
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

export type DemoCommentConfig = {
  userId: string;
  body: string;
};

export const DEMO_ACTIVITIES: readonly DemoActivity[] = [
  {
    id: DEMO_ACTIVITY_IDS.djurgarden,
    slug: 'djurgarden',
    imageFiles: [],
    startedAt: new Date('2026-08-29T03:42:00.000Z'),
    title: 'Djurgården x2',
    description: 'Catching the early morning in the green areas of Stockholm ☀️',
    activitySport: ActivityType.Run,
    tags: [],
    elapsedTimeS: 4480,
    averageHeartRate: 151,
    maximumHeartRate: 178,
    averageCadence: 171,
    maximumCadence: 186,
    averagePower: 0,
    maximumPower: 0,
    calories: 812,
    route: djurgarden,
    comments: [
      { userId: SOFIA_USER_ID, body: 'Both of the Djurgården, haha. Hope you enjoyed the ride!' },
      { userId: JOHN_USER_ID, body: 'I did! The legs felt better than expected too.' },
      { userId: EMMA_USER_ID, body: 'Five in the morning me would like to file a formal complaint.' },
    ],
    likes: [SOFIA_USER_ID, MARCUS_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['monk-lake-5k'],
    slug: 'monk-lake-5k',
    imageFiles: [],
    startedAt: new Date('2022-08-25T16:20:00.000Z'),
    title: 'Munksjön 5k',
    description: 'Round the lake we go',
    activitySport: ActivityType.Run,
    tags: ['workout'],
    elapsedTimeS: 2040,
    averageHeartRate: 158,
    maximumHeartRate: 184,
    averageCadence: 176,
    maximumCadence: 191,
    averagePower: 0,
    maximumPower: 0,
    calories: 594,
    route: munksjon,
    comments: [{ userId: MARCUS_USER_ID, body: 'Meh, I like Rocksjön better.' }],
    likes: [JOHN_USER_ID, MARCUS_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['island-ride'],
    slug: 'island-ride',
    imageFiles: ['island-ride/1.jpg'],
    startedAt: new Date('2020-01-20T15:05:00.000Z'),
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
    comments: [{ userId: JOHN_USER_ID, body: 'Cold hands, warm sunset. That is a pretty good trade.' }],
    likes: [JOHN_USER_ID, SOFIA_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['long-sunday-run'],
    slug: 'long-sunday-run',
    imageFiles: [],
    startedAt: new Date('2025-03-16T07:15:00.000Z'),
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
    comments: [
      { userId: MARCUS_USER_ID, body: 'You must have had a great view of the ocean!' },
      { userId: LUCAS_USER_ID, body: 'A conversational pace is brave when the conversation is with your own lungs.' },
    ],
    likes: [JOHN_USER_ID, SOFIA_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['park-walk'],
    slug: 'park-walk',
    imageFiles: ['park-walk/1.jpg'],
    startedAt: new Date('2026-08-12T18:10:00.000Z'),
    title: 'Forest walk',
    description: 'Relaxing evening walk.',
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
    route: scania,
    comments: [
      { userId: JOHN_USER_ID, body: 'A very good choice after a long day. The park looks peaceful.' },
      { userId: MAYA_USER_ID, body: 'The rare workout where the main achievement is returning home equally tired.' },
    ],
    likes: [JOHN_USER_ID, MARCUS_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['golden-gate-intervals'],
    slug: 'golden-gate-intervals',
    imageFiles: ['golden-gate-intervals/1.jpg', 'golden-gate-intervals/2.jpg'],
    startedAt: new Date('2026-08-10T15:35:00.000Z'),
    title: 'Golden Gate intervals',
    description: 'Really wanted to put in the distance today!',
    activitySport: ActivityType.Run,
    tags: ['long_run'],
    elapsedTimeS: 8920,
    averageHeartRate: 161,
    maximumHeartRate: 188,
    averageCadence: 179,
    maximumCadence: 198,
    averagePower: 0,
    maximumPower: 0,
    calories: 742,
    route: sanfrancisco,
    comments: [
      { userId: SOFIA_USER_ID, body: 'Short and sharp is right. Those efforts add up quickly.' },
      { userId: OSCAR_USER_ID, body: 'My legs read "intervals" and immediately requested a lawyer.' },
    ],
    likes: [SOFIA_USER_ID, MARCUS_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['central-park-progression'],
    slug: 'central-park-progression',
    imageFiles: ['central-park-progression/1.jpg'],
    startedAt: new Date('2026-08-07T11:10:00.000Z'),
    title: 'Central Park progression',
    description: 'Fun run with some friends.',
    activitySport: ActivityType.Run,
    tags: ['workout'],
    elapsedTimeS: 3380,
    averageHeartRate: 154,
    maximumHeartRate: 181,
    averageCadence: 174,
    maximumCadence: 190,
    averagePower: 0,
    maximumPower: 0,
    calories: 968,
    route: manhattan,
    comments: [
      {
        userId: MARCUS_USER_ID,
        body: 'The best kind of progression: relaxed enough at the start to enjoy it.',
      },
      { userId: EMMA_USER_ID, body: 'A sneaky tempo run wearing an easy-run costume. Very rude.' },
    ],
    likes: [JOHN_USER_ID, SOFIA_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['seawall-sunrise-ride'],
    slug: 'seawall-sunrise-ride',
    imageFiles: ['seawall-sunrise-ride/1.jpg'],
    startedAt: new Date('2026-08-03T13:20:00.000Z'),
    title: 'Seawall sunrise ride',
    description: 'A quick spin around the waterfront.',
    activitySport: ActivityType.Ride,
    tags: ['recovery'],
    elapsedTimeS: 1190,
    averageHeartRate: 132,
    maximumHeartRate: 158,
    averageCadence: 88,
    maximumCadence: 106,
    averagePower: 176,
    maximumPower: 388,
    calories: 874,
    route: vancouver,
    comments: [
      { userId: JOHN_USER_ID, body: 'Good work. That is a lovely route for a morning ride.' },
      {
        userId: LUCAS_USER_ID,
        body: 'Beauty ride, bud. The mountains are showing off harder than a Vancouver dad in Gore-Tex.',
      },
    ],
    likes: [JOHN_USER_ID, MARCUS_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['wildwood-climb'],
    slug: 'wildwood-climb',
    imageFiles: ['wildwood-climb/1.jpg'],
    startedAt: new Date('2026-07-29T16:45:00.000Z'),
    title: 'Wildwood climb',
    description: 'The hills, oh god the hills',
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
    route: portland,
    comments: [
      { userId: MAYA_USER_ID, body: 'The forest kindly provided free resistance training and a shoe subscription.' },
    ],
    likes: [SOFIA_USER_ID, MARCUS_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['thames-evening-ride'],
    slug: 'thames-evening-ride',
    imageFiles: ['thames-evening-ride/1.jpg'],
    startedAt: new Date('2026-07-24T18:25:00.000Z'),
    title: 'Thames evening ride',
    description: 'Bridges and river views.',
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
    route: london,
    comments: [{ userId: OSCAR_USER_ID, body: 'London is dangerously close to making cycling look fun.' }],
    likes: [JOHN_USER_ID, SOFIA_USER_ID],
  },
  {
    id: DEMO_ACTIVITY_IDS['canal-recovery-spin'],
    slug: 'canal-recovery-spin',
    imageFiles: ['canal-recovery-spin/1.jpg'],
    startedAt: new Date('2026-07-20T08:40:00.000Z'),
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
    route: amsterdam,
    comments: [{ userId: JOHN_USER_ID, body: 'Exactly the right amount of effort for a recovery day.' }],
    likes: [JOHN_USER_ID, MARCUS_USER_ID],
  },
];
