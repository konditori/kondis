export const ACTIVITY_TYPES = [
  'alpine_ski',
  'backcountry_ski',
  'badminton',
  'basketball',
  'canoeing',
  'cricket',
  'cross_country_ski',
  'crossfit',
  'dance',
  'e_bike_ride',
  'elliptical',
  'e_mountain_bike_ride',
  'golf',
  'gravel_ride',
  'handcycle',
  'high_intensity_interval_training',
  'hike',
  'ice_skate',
  'inline_skate',
  'kayaking',
  'kitesurf',
  'mountain_bike_ride',
  'padel',
  'physical_therapy',
  'pickleball',
  'pilates',
  'racquetball',
  'ride',
  'rock_climbing',
  'roller_ski',
  'rowing',
  'run',
  'sail',
  'skateboard',
  'snowboard',
  'snowshoe',
  'soccer',
  'squash',
  'stair_stepper',
  'stand_up_paddling',
  'surfing',
  'swim',
  'table_tennis',
  'tennis',
  'trail_run',
  'velomobile',
  'virtual_ride',
  'virtual_row',
  'virtual_run',
  'volleyball',
  'walk',
  'weight_training',
  'wheelchair',
  'windsurf',
  'workout',
  'yoga',
  'other',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

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

  const aliases: Partial<Record<string, ActivityType>> = {
    ...Object.fromEntries(ACTIVITY_TYPES.map((type) => [type, type] as const)),
    run: 'run',
    running: 'run',
    ride: 'ride',
    cycling: 'ride',
    biking: 'ride',
    bike: 'ride',
    e_biking: 'e_bike_ride',
    mountain_biking: 'mountain_bike_ride',
    e_mountain_biking: 'e_mountain_bike_ride',
    gravel_cycling: 'gravel_ride',
    walk: 'walk',
    walking: 'walk',
    hike: 'hike',
    hiking: 'hike',
    swim: 'swim',
    swimming: 'swim',
    alpine_ski: 'alpine_ski',
    alpine_skiing: 'alpine_ski',
    downhill_skiing: 'alpine_ski',
    roller_ski: 'roller_ski',
    roller_skiing: 'roller_ski',
    cross_country_ski: 'cross_country_ski',
    cross_country_skiing: 'cross_country_ski',
    nordic_ski: 'cross_country_ski',
    nordic_skiing: 'cross_country_ski',
    ice_skate: 'ice_skate',
    ice_skating: 'ice_skate',
    canoe: 'canoeing',
    kayak: 'kayaking',
    rock_climb: 'rock_climbing',
    row: 'rowing',
    sailing: 'sail',
    skateboard: 'skateboard',
    skateboarding: 'skateboard',
    snowboarding: 'snowboard',
    snowshoeing: 'snowshoe',
    football: 'soccer',
    stand_up_paddleboarding: 'stand_up_paddling',
    standup_paddling: 'stand_up_paddling',
    surf: 'surfing',
    weight_lifting: 'weight_training',
    weightlifting: 'weight_training',
    windsurfing: 'windsurf',
    hiit: 'high_intensity_interval_training',
    virtual_running: 'virtual_run',
    virtual_cycling: 'virtual_ride',
    virtual_rowing: 'virtual_row',
    other: 'other',
  };

  return aliases[normalizedSport] ?? 'other';
};

const RUNNING_BEST_EFFORT_ACTIVITY_TYPES = new Set<ActivityType>(['run', 'trail_run', 'virtual_run']);
const CYCLING_BEST_EFFORT_ACTIVITY_TYPES = new Set<ActivityType>([
  'ride',
  'gravel_ride',
  'mountain_bike_ride',
  'virtual_ride',
]);
const HEATMAP_ACTIVITY_TYPES = new Set<ActivityType>(['golf', 'sail', 'skateboard', 'soccer', 'surfing']);

export const supportsRunningBestEfforts = (type: ActivityType): boolean => RUNNING_BEST_EFFORT_ACTIVITY_TYPES.has(type);
export const supportsCyclingBestEfforts = (type: ActivityType): boolean => CYCLING_BEST_EFFORT_ACTIVITY_TYPES.has(type);
export const supportsDistanceBestEfforts = (type: ActivityType): boolean =>
  supportsRunningBestEfforts(type) || supportsCyclingBestEfforts(type);
export const usesActivityHeatmap = (type: ActivityType): boolean => HEATMAP_ACTIVITY_TYPES.has(type);
