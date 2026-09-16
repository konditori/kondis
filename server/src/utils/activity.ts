import { ACTIVITY_TYPES } from 'src/constants';
import { ActivityType } from 'src/enum';
import type { ActivityTypeSettings } from 'src/types';

const ACTIVITY_TYPE_BY_ID = new Map<ActivityType, ActivityTypeSettings>(
  ACTIVITY_TYPES.map((settings) => [settings.type, settings]),
);
const ACTIVITY_TYPE_BY_NAME = new Map<string, ActivityType>(
  ACTIVITY_TYPES.flatMap(({ type, aliases }) =>
    [type, ...aliases].map((name) => [name, type] as [string, ActivityType]),
  ),
);

export const getActivityTypeSettings = (type: ActivityType): ActivityTypeSettings => {
  const settings = ACTIVITY_TYPE_BY_ID.get(type);
  if (!settings) {
    throw new Error(`Missing settings for activity type ${type}`);
  }
  return settings;
};

const normalizeActivityType = (value: string | null | undefined): string =>
  (value ?? '')
    .trim()
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');

export const toActivityType = (sport?: string | null, subSport?: string | null): ActivityType => {
  const normalizedSport = normalizeActivityType(sport);
  const normalizedSubSport = normalizeActivityType(subSport);

  if (normalizedSubSport === 'virtual_activity') {
    if (['cycling', 'ride', 'biking', 'bike'].includes(normalizedSport)) {
      return ActivityType.VirtualRide;
    }
    if (['running', 'run'].includes(normalizedSport)) {
      return ActivityType.VirtualRun;
    }
    if (['rowing', 'row'].includes(normalizedSport)) {
      return ActivityType.VirtualRow;
    }
  }

  if (
    normalizedSport === 'trail_run' ||
    normalizedSport === 'trail_running' ||
    (['run', 'running'].includes(normalizedSport) && normalizedSubSport.includes('trail'))
  ) {
    return ActivityType.TrailRun;
  }

  return ACTIVITY_TYPE_BY_NAME.get(normalizedSport) ?? ActivityType.Other;
};
