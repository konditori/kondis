import { describe, expect, it } from 'vitest';

import { toActivityType } from 'src/domain/activity-type';

describe('toActivityType', () => {
  it.each([
    ['running', undefined, 'run'],
    ['running', 'trail', 'trail_run'],
    ['Trail Running', undefined, 'trail_run'],
    ['cycling', undefined, 'ride'],
    ['walking', undefined, 'walk'],
    ['swimming', undefined, 'swim'],
    ['alpine skiing', undefined, 'alpine_ski'],
    ['roller_skiing', undefined, 'roller_ski'],
    ['nordic skiing', undefined, 'cross_country_ski'],
  ])('maps %s / %s to %s', (sport, subSport, expected) => {
    expect(toActivityType(sport, subSport)).toBe(expected);
  });

  it('maps unsupported and missing source values to other', () => {
    expect(toActivityType('kayaking')).toBe('other');
    expect(toActivityType()).toBe('other');
  });
});
