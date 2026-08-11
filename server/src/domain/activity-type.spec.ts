import { describe, expect, it } from 'vitest';

import { ACTIVITY_TYPES, toActivityType, usesActivityHeatmap } from 'src/domain/activity-type';

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
  ])('maps %s / %s to %s', (sport, subSport, expected) => {
    expect(toActivityType(sport, subSport)).toBe(expected);
  });

  it('maps unsupported and missing source values to other', () => {
    expect(toActivityType('motorcycling')).toBe('other');
    expect(toActivityType()).toBe('other');
  });

  it('uses density maps for Strava heatmap sports', () => {
    const heatmapTypes = new Set(['golf', 'sail', 'skateboard', 'soccer', 'surfing']);

    for (const type of ACTIVITY_TYPES) {
      expect(usesActivityHeatmap(type)).toBe(heatmapTypes.has(type));
    }
  });
});
