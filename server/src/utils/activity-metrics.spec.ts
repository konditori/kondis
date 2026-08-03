import { describe, expect, it } from 'vitest';

import {
  computeElevationChange,
  computeMovingTime,
  computeNormalizedPower,
  inferSampleInterval,
} from 'src/utils/activity-metrics';

describe('computeNormalizedPower', () => {
  it('equals average power for a perfectly steady effort', () => {
    expect(computeNormalizedPower(Array.from({ length: 120 }, () => 200))).toBe(200);
  });

  it('exceeds average power for a variable effort, which is the whole point', () => {
    const surging = Array.from({ length: 600 }, (_, index) => (index % 60 < 30 ? 100 : 300));
    const normalized = computeNormalizedPower(surging);
    expect(normalized).not.toBeNull();
    expect(normalized as number).toBeGreaterThan(200);
  });

  it('returns null without power data', () => {
    expect(computeNormalizedPower([])).toBeNull();
  });

  it('scales the 30s window by the sample interval', () => {
    // At 5s sampling the window is 6 samples, not 30.
    expect(
      computeNormalizedPower(
        Array.from({ length: 50 }, () => 150),
        5,
      ),
    ).toBe(150);
  });
});

describe('computeElevationChange', () => {
  // A large sampleInterval collapses the smoothing window to a single sample, isolating the
  // threshold behavior from the smoothing behavior.
  const unsmoothed = { sampleIntervalS: 60 };

  it('sums deltas above the threshold', () => {
    expect(computeElevationChange([0, 10, 20, 30], unsmoothed)).toEqual({ gainM: 30, lossM: 0 });
    expect(computeElevationChange([30, 20, 10, 0], unsmoothed)).toEqual({ gainM: 0, lossM: 30 });
  });

  it('ignores jitter below the threshold', () => {
    expect(computeElevationChange([100, 101, 102, 101, 100], unsmoothed)).toEqual({ gainM: 0, lossM: 0 });
  });

  it('reports nothing for a stationary barometric drift', () => {
    expect(computeElevationChange([50, 50.2, 49.9, 50.1])).toEqual({ gainM: 0, lossM: 0 });
  });

  it('handles an empty stream', () => {
    expect(computeElevationChange([])).toEqual({ gainM: 0, lossM: 0 });
  });

  it('smooths away oscillation that raw accumulation would report as climbing', () => {
    // Alternating +/-5m around 100m. Nobody climbed anything.
    const sawtooth = Array.from({ length: 200 }, (_, index) => (index % 2 === 0 ? 105 : 95));

    expect(computeElevationChange(sawtooth, unsmoothed).gainM).toBeGreaterThan(500);
    expect(computeElevationChange(sawtooth, { sampleIntervalS: 1 }).gainM).toBeLessThan(20);
  });

  it('sizes the smoothing window in seconds, not samples', () => {
    // Period-4 square wave, which a 2-sample average still passes through but a 30-sample one
    // flattens. An alternating +/- pattern would cancel exactly at window 2 and prove nothing.
    const noisy = Array.from({ length: 120 }, (_, index) => (index % 4 < 2 ? 108 : 92));

    // Same data, different recording rates: at 1s the window is 30 samples, at 15s only 2.
    const dense = computeElevationChange(noisy, { sampleIntervalS: 1 }).gainM;
    const sparse = computeElevationChange(noisy, { sampleIntervalS: 15 }).gainM;

    expect(dense).toBeLessThan(20);
    expect(sparse).toBeGreaterThan(100);
  });
});

describe('computeMovingTime', () => {
  it('excludes samples below the speed threshold', () => {
    expect(computeMovingTime([0, 2, 2, 0, 3], [0, 1, 2, 3, 4])).toBe(3);
  });

  it('returns null without speed data', () => {
    expect(computeMovingTime([], [])).toBeNull();
  });
});

describe('inferSampleInterval', () => {
  it('takes the median so a recording gap does not skew it', () => {
    expect(inferSampleInterval([0, 1, 2, 60, 61])).toBe(1);
  });

  it('defaults to one second when there is nothing to infer from', () => {
    expect(inferSampleInterval([])).toBe(1);
    expect(inferSampleInterval([5])).toBe(1);
  });
});
