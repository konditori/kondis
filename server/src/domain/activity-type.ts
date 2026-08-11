export const ACTIVITY_TYPES = [
  'run',
  'ride',
  'trail_run',
  'walk',
  'hike',
  'swim',
  'alpine_ski',
  'roller_ski',
  'cross_country_ski',
  'ice_skate',
  'other',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

const normalize = (value: string | null | undefined): string =>
  (value ?? '')
    .trim()
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
    run: 'run',
    running: 'run',
    ride: 'ride',
    cycling: 'ride',
    biking: 'ride',
    bike: 'ride',
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
    other: 'other',
  };

  return aliases[normalizedSport] ?? 'other';
};

export const supportsRunningBestEfforts = (type: ActivityType): boolean => type === 'run' || type === 'trail_run';
