import { describe, expect, it } from 'vitest';

import { ACTIVITY_TYPE_IDS, ACTIVITY_TYPES, AverageMetric, BestEffortGroup } from 'src/types';
import { getActivityTypeSettings, toActivityType } from 'src/utils/activity';

describe('toActivityType', () => {
  it.each([
    ['running', undefined, 'run'],
    ['running', 'trail', 'trail_run'],
    ['Trail Running', undefined, 'trail_run'],
    ['cycling', undefined, 'ride'],
    ['walking', undefined, 'walk'],
    ['hiking', undefined, 'hike'],
    ['swimming', undefined, 'swim'],
    ['alpine skiing', undefined, 'alpine_ski'],
    ['roller_skiing', undefined, 'roller_ski'],
    ['nordic skiing', undefined, 'cross_country_ski'],
    ['ice skating', undefined, 'ice_skate'],
    ['MountainBikeRide', undefined, 'mountain_bike_ride'],
    ['EBikeRide', undefined, 'e_bike_ride'],
    ['EMountainBikeRide', undefined, 'e_mountain_bike_ride'],
    ['e_biking', undefined, 'e_bike_ride'],
    ['stand up paddleboarding', undefined, 'stand_up_paddling'],
    ['HIIT', undefined, 'high_intensity_interval_training'],
    ['virtual running', undefined, 'virtual_run'],
    ['cycling', 'virtual_activity', 'virtual_ride'],
    ['running', 'virtual activity', 'virtual_run'],
    ['rowing', 'VirtualActivity', 'virtual_row'],
  ])('maps %s / %s to %s', (sport, subSport, expected) => {
    expect(toActivityType(sport, subSport)).toBe(expected);
  });

  it('maps unsupported and missing source values to other', () => {
    expect(toActivityType('motorcycling')).toBe('other');
    expect(toActivityType()).toBe('other');
  });

  it('accepts every canonical activity type without an alias', () => {
    for (const type of ACTIVITY_TYPE_IDS) {
      expect(toActivityType(type)).toBe(type);
    }
  });

  it('maps every declared alias to its activity type', () => {
    for (const { type, aliases } of ACTIVITY_TYPES) {
      for (const alias of aliases) {
        expect(toActivityType(alias)).toBe(type);
      }
    }
  });

  it('does not declare the same canonical name or alias twice', () => {
    const names = ACTIVITY_TYPES.flatMap(({ type, aliases }) => [type, ...aliases]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('defines settings for every activity type', () => {
    expect(ACTIVITY_TYPES.map(({ type }) => type)).toEqual(ACTIVITY_TYPE_IDS);
  });

  it.each([
    ['roller_ski', AverageMetric.Pace],
    ['hike', AverageMetric.Pace],
    ['ice_skate', AverageMetric.None],
    ['swim', AverageMetric.SwimPace],
  ] as const)('defines the average metric for %s', (type, averageMetric) => {
    expect(getActivityTypeSettings(type).averageMetric).toBe(averageMetric);
  });

  it('groups all running and cycling best-effort activity types', () => {
    const running = new Set(['run', 'trail_run', 'virtual_run']);
    const cycling = new Set(['ride', 'gravel_ride', 'mountain_bike_ride', 'virtual_ride']);

    for (const type of ACTIVITY_TYPE_IDS) {
      const expected = running.has(type)
        ? BestEffortGroup.Run
        : cycling.has(type)
          ? BestEffortGroup.Ride
          : BestEffortGroup.None;
      expect(getActivityTypeSettings(type).bestEffortGroup).toBe(expected);
    }
  });

  it('enables average power for pedal-powered cycling types', () => {
    const powerTypes = new Set([
      'gravel_ride',
      'handcycle',
      'mountain_bike_ride',
      'ride',
      'velomobile',
      'virtual_ride',
    ]);

    for (const type of ACTIVITY_TYPE_IDS) {
      expect(getActivityTypeSettings(type).showAveragePower).toBe(powerTypes.has(type));
    }
  });
});
