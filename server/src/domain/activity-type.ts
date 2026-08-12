export enum AverageMetric {
  None = 'none',
  Pace = 'pace',
  SwimPace = 'swim_pace',
  Speed = 'speed',
}

export enum BestEffortGroup {
  None = 'none',
  Run = 'run',
  Ride = 'ride',
}

export type ActivityTypeSettings = {
  type: string;
  aliases: readonly string[];
  averageMetric: AverageMetric;
  showAveragePower: boolean;
  bestEffortGroup: BestEffortGroup;
};

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

export const ACTIVITY_TYPE_SETTINGS = [
  defineActivityType('alpine_ski', {
    aliases: ['alpine_skiing', 'downhill_skiing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('backcountry_ski', { averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('badminton', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('basketball', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('canoeing', { aliases: ['canoe'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('cricket', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('cross_country_ski', {
    aliases: ['cross_country_skiing', 'nordic_ski', 'nordic_skiing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('crossfit', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('dance', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('e_bike_ride', {
    aliases: ['e_biking'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('elliptical', { averageMetric: AverageMetric.None, showAveragePower: false }),
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
  defineActivityType('handcycle', { averageMetric: AverageMetric.Speed, showAveragePower: true }),
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
  defineActivityType('inline_skate', { averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('kayaking', { aliases: ['kayak'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('kitesurf', { averageMetric: AverageMetric.Speed, showAveragePower: false }),
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
  defineActivityType('physical_therapy', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('pickleball', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('pilates', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('racquetball', { averageMetric: AverageMetric.None, showAveragePower: false }),
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
  defineActivityType('rowing', { aliases: ['row'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
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
  defineActivityType('stair_stepper', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('stand_up_paddling', {
    aliases: ['stand_up_paddleboarding', 'standup_paddling'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('surfing', { aliases: ['surf'], averageMetric: AverageMetric.Speed, showAveragePower: false }),
  defineActivityType('swim', {
    aliases: ['swimming'],
    averageMetric: AverageMetric.SwimPace,
    showAveragePower: false,
  }),
  defineActivityType('table_tennis', { averageMetric: AverageMetric.None, showAveragePower: false }),
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
  defineActivityType('velomobile', { averageMetric: AverageMetric.Speed, showAveragePower: true }),
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
  defineActivityType('volleyball', { averageMetric: AverageMetric.None, showAveragePower: false }),
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
  defineActivityType('wheelchair', { averageMetric: AverageMetric.Pace, showAveragePower: false }),
  defineActivityType('windsurf', {
    aliases: ['windsurfing'],
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
  defineActivityType('workout', { averageMetric: AverageMetric.None, showAveragePower: false }),
  defineActivityType('yoga', {
    averageMetric: AverageMetric.None,
    showAveragePower: false,
  }),
  defineActivityType('other', {
    averageMetric: AverageMetric.Speed,
    showAveragePower: false,
  }),
] as const satisfies readonly ActivityTypeSettings[];

export type ActivityType = (typeof ACTIVITY_TYPE_SETTINGS)[number]['type'];

export const ACTIVITY_TYPES = ACTIVITY_TYPE_SETTINGS.map(({ type }) => type) as [ActivityType, ...ActivityType[]];
const ACTIVITY_TYPE_LOOKUP = new Map<string, ActivityType>(
  ACTIVITY_TYPE_SETTINGS.flatMap(({ type, aliases }) => [type, ...aliases].map((name) => [name, type] as const)),
);

export const activityTypeSettings = (type: ActivityType): ActivityTypeSettings => {
  const settings = ACTIVITY_TYPE_SETTINGS.find((candidate) => candidate.type === type);
  if (!settings) {
    throw new Error(`Missing settings for activity type ${type}`);
  }
  return settings;
};

export const activityTypesForBestEffortGroup = (group: BestEffortGroup): ActivityType[] =>
  ACTIVITY_TYPES.filter((type) => activityTypeSettings(type).bestEffortGroup === group);

const normalize = (value: string | null | undefined): string =>
  (value ?? '')
    .trim()
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

export const toActivityType = (sport?: string | null, subSport?: string | null): ActivityType => {
  const normalizedSport = normalize(sport);
  const normalizedSubSport = normalize(subSport);

  if (
    normalizedSport === 'trail_run' ||
    normalizedSport === 'trail_running' ||
    (['run', 'running'].includes(normalizedSport) && normalizedSubSport.includes('trail'))
  ) {
    return 'trail_run';
  }

  return ACTIVITY_TYPE_LOOKUP.get(normalizedSport) ?? 'other';
};

export const supportsRunningBestEfforts = (type: ActivityType): boolean =>
  activityTypeSettings(type).bestEffortGroup === BestEffortGroup.Run;
export const supportsCyclingBestEfforts = (type: ActivityType): boolean =>
  activityTypeSettings(type).bestEffortGroup === BestEffortGroup.Ride;
export const supportsDistanceBestEfforts = (type: ActivityType): boolean =>
  activityTypeSettings(type).bestEffortGroup !== BestEffortGroup.None;
