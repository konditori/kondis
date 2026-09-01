import { describe, expect, it } from 'vitest';

import {
  computeBiggestClimb,
  computeCyclingBestEfforts,
  computeCyclingPowerBestEfforts,
  computeRunningBestEfforts,
} from 'src/utils/best-effort';

describe('computeRunningBestEfforts', () => {
  it('computes every attainable standard distance with interpolation', () => {
    const distance = Array.from({ length: 101 }, (_, index) => index * 100);
    const time = distance.map((meters) => meters / 4);

    const efforts = computeRunningBestEfforts(distance, time);

    expect(efforts.map(({ type }) => type)).toEqual(['400m', '1k', 'half_mile', '1_mile', '2_miles', '5k', '10k']);
    expect(efforts.find(({ type }) => type === '1_mile')?.elapsedTime).toBeCloseTo(402.336);
  });

  it('finds the fastest rolling effort instead of only measuring from the start', () => {
    const distance = [0, 100, 200, 300, 400, 500, 600, 700, 800];
    const time = [0, 40, 80, 120, 160, 170, 180, 190, 200];

    const effort = computeRunningBestEfforts(distance, time).find(({ type }) => type === '400m');

    expect(effort).toMatchObject({ elapsedTime: 40, startTime: 160, endTime: 200 });
  });

  it('includes pauses inside an effort and uses the latest point on a boundary plateau', () => {
    const effort = computeRunningBestEfforts([0, 100, 100, 200, 300, 400, 500], [0, 25, 85, 110, 135, 160, 185]).find(
      ({ type }) => type === '400m',
    );

    expect(effort).toMatchObject({ elapsedTime: 100, startTime: 85, endTime: 185 });
  });

  it('unrolls lap distance resets', () => {
    const effort = computeRunningBestEfforts([0, 100, 200, 0, 100, 200], [0, 25, 50, 75, 100, 125]).find(
      ({ type }) => type === '400m',
    );

    expect(effort?.elapsedTime).toBe(125);
  });

  it('returns no efforts without aligned distance and time streams', () => {
    expect(computeRunningBestEfforts([], [])).toEqual([]);
    expect(computeRunningBestEfforts([0, 500], [])).toEqual([]);
  });

  it('computes cycling-specific standard distances', () => {
    const distance = [0, 5000, 10_000, 20_000, 40_000, 50_000, 100_000];
    const time = distance.map((meters) => meters / 10);

    expect(computeCyclingBestEfforts(distance, time).map(({ type }) => type)).toEqual([
      '5_miles',
      '10k',
      '10_miles',
      '20k',
      '30k',
      '40k',
      '50k',
      '80k',
      '50_miles',
      '90k',
      '100k',
    ]);
  });

  it('computes every requested cycling distance when the ride is long enough', () => {
    const distance = Array.from({ length: 201 }, (_, index) => index * 1000);
    const time = distance.map((meters) => meters / 10);

    expect(computeCyclingBestEfforts(distance, time).map(({ type }) => type)).toEqual([
      '5_miles',
      '10k',
      '10_miles',
      '20k',
      '30k',
      '40k',
      '50k',
      '80k',
      '50_miles',
      '90k',
      '100k',
      '100_miles',
      '180k',
    ]);
  });

  it('finds biggest climb and duration-based average power', () => {
    expect(computeBiggestClimb([100, 90, 110, 145, 130], [0, 10, 20, 30, 40])).toMatchObject({
      value: 55,
      startTime: 10,
      endTime: 30,
    });

    const power = Array.from({ length: 31 }, (_, index) => (index >= 10 ? 300 : 100));
    const time = power.map((_, index) => index);
    expect(computeCyclingPowerBestEfforts(power, time).find(({ type }) => type === 'power_5s')).toMatchObject({
      value: 300,
      startTime: 10,
      endTime: 15,
    });
  });

  it('produces the requested power-curve durations', () => {
    const time = Array.from({ length: 3601 }, (_, index) => index);
    const power = time.map(() => 250);
    const types = computeCyclingPowerBestEfforts(power, time).map(({ type }) => type);

    expect(types).toEqual(
      expect.arrayContaining([
        'power_5s',
        'power_30s',
        'power_1m',
        'power_5m',
        'power_10m',
        'power_20m',
        'power_30m',
        'power_1h',
      ]),
    );
  });
});
