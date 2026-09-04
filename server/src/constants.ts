import type { ActivityTagSettings, ActivityTypeSettings, BestEffortType } from 'src/types';
import { AverageMetric, BestEffortGroup } from 'src/types';
export {
  JOB_CONCURRENCY,
  JOB_CRON,
  JOB_EXPIRE_SECONDS,
  JOB_RETENTION_SECONDS,
  JOB_RETRY_DELAY_SECONDS,
  JOB_RETRY_LIMIT,
} from 'src/jobs/job-semantics';

export const JOB_SCHEMA = 'kondis_jobs';

export const IMAGE_SUPPORTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif']);
export const IMAGE_MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heif: 'image/heif',
  avif: 'image/avif',
};
export const IMAGE_THUMBNAIL_SIZE = 250;
export const IMAGE_PREVIEW_SIZE = 1440;
export const IMAGE_PROCESSING_VERSION = 1;

export const TRACK_SIMPLIFY_TOLERANCE_DEG = 0.00002;
export const ROUTE_CANDIDATE_LIMIT = 250;
export const ROUTE_PREFILTER_RADIUS_METERS = 250;
export const ROUTE_ENDPOINT_TOLERANCE_METERS = 120;
export const ROUTE_MIN_LENGTH_RATIO = 0.88;
export const ROUTE_MAX_LENGTH_RATIO = 1.14;
export const ROUTE_FRECHET_TOLERANCE_METERS = 200;
export const UNRANKED = 2_147_483_647;
export const RANKING_UPDATE_BATCH_SIZE = 1000;

export const ACTIVITY_TAG_IDS = [
  'race',
  'long_run',
  'commute',
  'workout',
  'competition',
  'recovery',
  'with_pet',
  'with_kid',
  'for_a_cause',
] as const;

export const ACTIVITY_TAGS: readonly ActivityTagSettings[] = [
  { tag: 'race', label: 'Race', sports: 'all' },
  {
    tag: 'long_run',
    label: 'Long Run',
    sports: ['run', 'trail_run', 'virtual_run'],
  },
  { tag: 'commute', label: 'Commute', sports: 'all' },
  { tag: 'workout', label: 'Workout', sports: 'all' },
  { tag: 'competition', label: 'Competition', sports: 'all' },
  { tag: 'recovery', label: 'Recovery', sports: 'all' },
  { tag: 'with_pet', label: 'With Pet', sports: 'all' },
  { tag: 'with_kid', label: 'With Kid', sports: 'all' },
  { tag: 'for_a_cause', label: 'For a Cause', sports: 'all' },
];

const defineActivityType = <const T extends string>(
  type: T,
  settings: Omit<ActivityTypeSettings, 'type' | 'aliases' | 'bestEffortGroup'> &
    Partial<Pick<ActivityTypeSettings, 'aliases' | 'bestEffortGroup'>>,
): ActivityTypeSettings & { type: T } => ({
  type,
  aliases: [],
  bestEffortGroup: BestEffortGroup.None,
  ...settings,
});

// All supported activity types with their individual quirks
export const ACTIVITY_TYPES = [
  defineActivityType('alpine_ski', {
    aliases: ['alpine_skiing', 'downhill_skiing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('backcountry_ski', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('badminton', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('basketball', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('canoeing', {
    aliases: ['canoe'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('cricket', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('cross_country_ski', {
    aliases: ['cross_country_skiing', 'nordic_ski', 'nordic_skiing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('crossfit', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('dance', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('e_bike_ride', {
    aliases: ['e_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('elliptical', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('e_mountain_bike_ride', {
    aliases: ['e_mountain_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('golf', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('gravel_ride', {
    aliases: ['gravel_cycling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('handcycle', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
  }),
  defineActivityType('high_intensity_interval_training', {
    aliases: ['hiit'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('hike', {
    aliases: ['hiking'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('ice_skate', {
    aliases: ['ice_skating'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('inline_skate', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('kayaking', {
    aliases: ['kayak'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('kitesurf', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('mountain_bike_ride', {
    aliases: ['mountain_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('padel', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('physical_therapy', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('pickleball', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('pilates', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('racquetball', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('ride', {
    aliases: ['cycling', 'biking', 'bike'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('rock_climbing', {
    aliases: ['rock_climb'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('roller_ski', {
    aliases: ['roller_skiing'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('rowing', {
    aliases: ['row'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('run', {
    aliases: ['running'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
    bestEffortGroup: BestEffortGroup.Run,
  }),
  defineActivityType('sail', {
    aliases: ['sailing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('skateboard', {
    aliases: ['skateboarding'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('snowboard', {
    aliases: ['snowboarding'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('snowshoe', {
    aliases: ['snowshoeing'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('soccer', {
    aliases: ['football'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('squash', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('stair_stepper', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('stand_up_paddling', {
    aliases: ['stand_up_paddleboarding', 'standup_paddling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('surfing', {
    aliases: ['surf'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('swim', {
    aliases: ['swimming'],
    averageMetric: AverageMetric.SwimPace,
    showAveragePower: false,
  }),
  defineActivityType('table_tennis', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('tennis', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('trail_run', {
    aliases: ['trail_running'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
    bestEffortGroup: BestEffortGroup.Run,
  }),
  defineActivityType('velomobile', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
  }),
  defineActivityType('virtual_ride', {
    aliases: ['virtual_cycling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: true,
    bestEffortGroup: BestEffortGroup.Ride,
  }),
  defineActivityType('virtual_row', {
    aliases: ['virtual_rowing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('virtual_run', {
    aliases: ['virtual_running'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
    bestEffortGroup: BestEffortGroup.Run,
  }),
  defineActivityType('volleyball', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('walk', {
    aliases: ['walking'],
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('weight_training', {
    aliases: ['weight_lifting', 'weightlifting'],
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('wheelchair', {
    averageMetric: AverageMetric.Pace,
    showAveragePower: false,
  }),
  defineActivityType('windsurf', {
    aliases: ['windsurfing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('workout', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('yoga', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('other', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
] as const satisfies readonly ActivityTypeSettings[];

export const ACTIVITY_TYPE_IDS = ACTIVITY_TYPES.map(({ type }) => type) as [
  (typeof ACTIVITY_TYPES)[number]['type'],
  ...(typeof ACTIVITY_TYPES)[number]['type'][],
];

export const RUNNING_BEST_EFFORTS = [
  { type: '400m', distance: 400, valueKind: 'duration', higherIsBetter: false },
  { type: '1k', distance: 1000, valueKind: 'duration', higherIsBetter: false },
  {
    type: 'half_mile',
    distance: 804.672,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '1_mile',
    distance: 1609.344,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '2_miles',
    distance: 3218.688,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  { type: '5k', distance: 5000, valueKind: 'duration', higherIsBetter: false },
  {
    type: '10k',
    distance: 10_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '15k',
    distance: 15_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '10_miles',
    distance: 16_093.44,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '20k',
    distance: 20_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: 'half_marathon',
    distance: 21_097.5,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '30k',
    distance: 30_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: 'marathon',
    distance: 42_195,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '50k',
    distance: 50_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
] as const;

export const CYCLING_BEST_EFFORTS = [
  { type: 'longest_ride', valueKind: 'distance', higherIsBetter: true },
  { type: 'biggest_climb', valueKind: 'elevation', higherIsBetter: true },
  { type: 'elevation_gain', valueKind: 'elevation', higherIsBetter: true },
  {
    type: '5_miles',
    distance: 8046.72,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '10k',
    distance: 10_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '10_miles',
    distance: 16_093.44,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '20k',
    distance: 20_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '30k',
    distance: 30_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '40k',
    distance: 40_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '50k',
    distance: 50_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '80k',
    distance: 80_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '50_miles',
    distance: 80_467.2,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '90k',
    distance: 90_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '100k',
    distance: 100_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '100_miles',
    distance: 160_934.4,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  {
    type: '180k',
    distance: 180_000,
    valueKind: 'duration',
    higherIsBetter: false,
  },
  { type: 'power_5s', duration: 5, valueKind: 'power', higherIsBetter: true },
  { type: 'power_15s', duration: 15, valueKind: 'power', higherIsBetter: true },
  { type: 'power_30s', duration: 30, valueKind: 'power', higherIsBetter: true },
  { type: 'power_1m', duration: 60, valueKind: 'power', higherIsBetter: true },
  { type: 'power_2m', duration: 120, valueKind: 'power', higherIsBetter: true },
  { type: 'power_3m', duration: 180, valueKind: 'power', higherIsBetter: true },
  { type: 'power_5m', duration: 300, valueKind: 'power', higherIsBetter: true },
  { type: 'power_8m', duration: 480, valueKind: 'power', higherIsBetter: true },
  {
    type: 'power_10m',
    duration: 600,
    valueKind: 'power',
    higherIsBetter: true,
  },
  {
    type: 'power_15m',
    duration: 900,
    valueKind: 'power',
    higherIsBetter: true,
  },
  {
    type: 'power_20m',
    duration: 1200,
    valueKind: 'power',
    higherIsBetter: true,
  },
  {
    type: 'power_30m',
    duration: 1800,
    valueKind: 'power',
    higherIsBetter: true,
  },
  {
    type: 'power_45m',
    duration: 2700,
    valueKind: 'power',
    higherIsBetter: true,
  },
  {
    type: 'power_1h',
    duration: 3600,
    valueKind: 'power',
    higherIsBetter: true,
  },
  {
    type: 'power_2h',
    duration: 7200,
    valueKind: 'power',
    higherIsBetter: true,
  },
] as const;

export const BEST_EFFORT_TYPES = [
  ...new Set([...RUNNING_BEST_EFFORTS.map(({ type }) => type), ...CYCLING_BEST_EFFORTS.map(({ type }) => type)]),
] as [BestEffortType, ...BestEffortType[]];
