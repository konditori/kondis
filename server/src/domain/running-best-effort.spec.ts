import { describe, expect, it } from 'vitest';

import { computeRunningBestEfforts } from 'src/domain/running-best-effort';

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
});
